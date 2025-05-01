from datetime import datetime, timezone
import json
from sqlalchemy import Column, Integer, String, Boolean, JSON, TIMESTAMP, ForeignKey
from sqlalchemy.orm import Mapped, relationship
from typing import List
from pgvector.sqlalchemy import Vector

from backend import Base

class User(Base):
    __tablename__ = 'user'

    id = Column(Integer, primary_key=True)
    email = Column(String(50), unique=True, nullable=True)
    linkedin_id = Column(String(50), unique=True, nullable=False)
    first_name = Column(String(50), nullable=False)
    last_name = Column(String(50), nullable=True)
    linkedin_profile_url = Column(String(250), nullable=True)  # TODO: change to False
    profile_picture_url = Column(String(500), nullable=True)
    access_token = Column(String(512), nullable=False)
    token_expires_at = Column(TIMESTAMP(timezone=True), nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
    user_json = Column(JSON, nullable=True) # Keep this for additional LinkedIn profile data and anything else

    # Define relationships
    parsed_responses: Mapped[List["ParsedResponse"]] = relationship("ParsedResponse", back_populates="user", cascade="all, delete-orphan")

    def user_data(self):
        return json.loads(self.user_json) if self.user_json else {}

class ParseField(Base):
    __tablename__ = 'parse_field'

    id = Column(Integer, primary_key=True)
    name = Column(String(200), nullable=False, unique=True, index=True)

    # Define relationships
    parse_field_values: Mapped[List["ParseFieldValue"]] = relationship("ParseFieldValue", back_populates="parse_field", cascade="all, delete-orphan")

class ParsedResponse(Base):
    __tablename__ = 'parsed_response'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('user.id'), nullable=False)
    name = Column(String(200), nullable=True)
    raw_text = Column(String(15000), nullable=False)
    anonymize = Column(Boolean, nullable=False, default=False)
    parsed_response_json = Column(JSON, nullable=True)  # For additional details
    created_at = Column(TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Define relationships
    user: Mapped["User"] = relationship("User", back_populates="parsed_responses")
    parse_field_values: Mapped[List["ParseFieldValue"]] = relationship("ParseFieldValue", back_populates="parsed_response", cascade="all, delete-orphan")

    def parsed_response_data(self):
        return json.loads(self.parsed_response_json) if self.parsed_response_json else {}

class ParseFieldValue(Base):
    __tablename__ = 'parse_field_value'

    id = Column(Integer, primary_key=True)
    parse_field_id = Column(Integer, ForeignKey('parse_field.id'), nullable=False)
    parsed_response_id = Column(Integer, ForeignKey('parsed_response.id'), nullable=False)
    value = Column(String(5000), nullable=True)  # Can be null

    # Define relationships
    parse_field: Mapped["ParseField"] = relationship("ParseField", back_populates="parse_field_values")
    parsed_response: Mapped["ParsedResponse"] = relationship("ParsedResponse", back_populates="parse_field_values")

class Embedding(Base):
    __tablename__ = 'embedding'

    id = Column(Integer, primary_key=True)

    # Only one of these should be non-null
    parsed_response_id = Column(Integer, ForeignKey('parsed_response.id'), nullable=True)
    parsed_field_value_id = Column(Integer, ForeignKey('parse_field_value.id'), nullable=True)

    embedding = Column(Vector(1536), nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc), nullable=False)
