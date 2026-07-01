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

    money = Column(Integer, default=100)

    # ISO date string (e.g. "2026-07-01") of the last daily problem solved
    daily_solved_date = Column(String, nullable=True, default=None)

    def package_data(self):
        return {
            "username": self.username,
            "current_level": self.current_level,
            "unlocked_levels": self.unlocked_levels,
            "money": self.money,
            "daily_solved_date": self.daily_solved_date,
        }
