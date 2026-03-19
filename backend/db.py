import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    full_name = Column(String(255), nullable=True)
    hashed_password = Column(String(255), nullable=True)  # Nullable for OAuth users
    provider = Column(String(50), default="email")  # "email", "google"
    provider_id = Column(String(255), nullable=True)  # OAuth provider user ID
    created_at = Column(DateTime, default=datetime.utcnow)

    # Preferences
    default_style = Column(String(50), default="photorealistic")
    default_prompt = Column(Text, nullable=True)

    # Relationships
    generations = relationship("Generation", back_populates="user", cascade="all, delete-orphan")


class Generation(Base):
    __tablename__ = "generations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Input
    sketch_b64 = Column(Text, nullable=False)  # Base64 of original sketch
    prompt = Column(Text, nullable=True)
    style = Column(String(50), nullable=True)

    # Output
    output_b64 = Column(Text, nullable=False)  # Base64 of generated image 

    # Metadata
    inference_ms = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="generations")


def get_db():
    """Dependency to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database tables"""
    Base.metadata.create_all(bind=engine)
