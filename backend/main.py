from copy import deepcopy
import math
from fastapi import FastAPI, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from .network import (
    generate_network,
    calculate_power_flow,
    update_network,
    solve_network,
    load_level,
)
from .schemas import (
    ProgressUpdateRequest,
    TopologyChangeRequest, 
    LoadLevelRequest, 
    NetworkStateRequest,
    SwitchNodeRequest,
    ResetSwitchesRequest,
    dict_to_network_state,
    RegisterRequest,
    LoginRequest,
    rewardResponse
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi import APIRouter

from .database import Base, engine, SessionLocal
from .models import Player
from .auth import (
    hash_password,
    verify_password,
)
from .jwt_utils import (
    create_access_token,
    decode_access_token,
)

Base.metadata.create_all(bind=engine)

app = FastAPI()
router = APIRouter(prefix="/api")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_player(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    username = payload["sub"]
    player = db.query(Player).filter(Player.username == username).first()
    if not player:
        raise HTTPException(status_code=401, detail="User not found")

    return player


@router.post("/register")
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(Player).filter(Player.username == data.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")

    player = Player(
        username=data.username,
        password_hash=hash_password(data.password),
    )
    db.add(player)
    db.commit()
    db.refresh(player)

    token = create_access_token({"sub": player.username})

    return {
        "access_token": token,
        "token_type": "bearer",
        "player": player.package_data()
    }

@router.post("/login")
def login(data: LoginRequest, db: Session = Depends(get_db)):
    player = db.query(Player).filter(Player.username == data.username).first()
    if not player or not verify_password(data.password, player.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token({"sub": player.username})

    return {
        "access_token": token,
        "token_type": "bearer",
        "player": player.package_data()
    }


@router.post("/save_progress")
def save_progress(
    data: ProgressUpdateRequest,
    player: Player = Depends(get_current_player),
    db: Session = Depends(get_db),
):
    player.current_level = data.current_level
    player.unlocked_levels = data.unlocked_levels

    db.commit()
    return {"status": "ok"}

@router.get("/me")
def get_me(player: Player = Depends(get_current_player)):
    return player.package_data()

@router.post("/check_solution", response_model=rewardResponse)
def check_solution(
    data: NetworkStateRequest,
    player: Player = Depends(get_current_player),
    db: Session = Depends(get_db),
):
    """
    Checking players solution and rewarding him if he solved a new level
    """
    network = dict_to_network_state(data.network_data)
    network = calculate_power_flow(network)

    all_lines_within_capacity = all(
        abs(line.flow) <= line.limit for line in network.lines.values()
    )

    reward = 0
    # If the player completed a new level, unlock the next level
    if all_lines_within_capacity:
        if player.unlocked_levels == player.current_level:
            player.unlocked_levels += 1
            reward = 50  # Reward for completing the level
            player.money += reward
        db.commit()

    return rewardResponse(
        solved=all_lines_within_capacity,
        player=player.package_data(), 
        reward=reward
    )


@router.post("/solve")
def solve_net(data: NetworkStateRequest):
    network = dict_to_network_state(data.network_data)
    network = solve_network(network)
    return network


# @router.post("/save_network")
# def save_network(network: dict):
#     os.makedirs("saves", exist_ok=True)
#     timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
#     filepath = f"saves/network_{timestamp}.json"
#     with open(filepath, "w") as f:
#         json.dump(network, f)
#     return {"status": "Network saved", "file": filepath}

# # CAREFUL: THIS IS UNSAFE SINCE ANY FILE PATH CAN BE GIVEN
# @router.post("/load_network")
# def load_network(file_path: str):
#     network = update_network_from_file(file_path)
#     network = calculate_power_flow(network)
#     return network


@router.post("/load_level")
def load_level_endpoint(
    data: LoadLevelRequest,
    player: Player = Depends(get_current_player),
    db: Session = Depends(get_db),
):
    if data.level_num > player.unlocked_levels:
        raise HTTPException(
            status_code=403,
            detail="Level not unlocked",
        )

    # Load the level
    network = load_level(data.level_num)

    # Update current level if progressing
    player.current_level = data.level_num
    db.commit()

    return network



app.include_router(router)