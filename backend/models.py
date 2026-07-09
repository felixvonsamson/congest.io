from typing import Optional

from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class Player(Base):
    __tablename__ = "players"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    username: Mapped[str] = mapped_column(unique=True, index=True)
    password_hash: Mapped[str] = mapped_column()

    current_level: Mapped[int] = mapped_column(default=1)
    unlocked_levels: Mapped[int] = mapped_column(default=1)

    money: Mapped[int] = mapped_column(default=100)

    # ISO date string (e.g. "2026-07-01") of the last daily problem solved
    daily_solved_date: Mapped[Optional[str]] = mapped_column(default=None)
    daily_solved_count: Mapped[int] = mapped_column(default=0)
    daily_streak: Mapped[int] = mapped_column(default=0)

    def package_data(self):
        return {
            "username": self.username,
            "current_level": self.current_level,
            "unlocked_levels": self.unlocked_levels,
            "money": self.money,
            "daily_solved_date": self.daily_solved_date,
            "daily_solved_count": self.daily_solved_count or 0,
            "daily_streak": self.daily_streak or 0,
        }
