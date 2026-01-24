from sqlalchemy import Column, Integer, String
from .database import Base
import json

class Player(Base):
    __tablename__ = "players"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)

    current_level = Column(Integer, default=1)
    unlocked_levels = Column(Integer, default=1)
