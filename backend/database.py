from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

DATABASE_URL = "sqlite:///./game.db"
# later: postgres://...

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},  # sqlite only
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass
