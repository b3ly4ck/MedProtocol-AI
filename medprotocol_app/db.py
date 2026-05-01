import os
import uuid

from sqlalchemy import Column, String, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.types import JSON


Base = declarative_base()


class ProtocolRow(Base):
    __tablename__ = "protocols"

    id = Column(String, primary_key=True)
    data = Column(JSONB().with_variant(JSON(), "sqlite"), nullable=False)


def get_database_url():
    url = os.getenv("DATABASE_URL")
    if not url:
        url = "sqlite+aiosqlite:///./medprotocol.db"
    return url


engine = create_async_engine(get_database_url())
Session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def save_protocol(data):
    protocol_id = data.get("id")
    if not protocol_id:
        protocol_id = str(uuid.uuid4())
        data["id"] = protocol_id

    async with Session() as session:
        row = await session.get(ProtocolRow, protocol_id)
        if row:
            row.data = data
        else:
            row = ProtocolRow(id=protocol_id, data=data)
            session.add(row)

        await session.commit()
        return data


async def get_protocol(protocol_id):
    async with Session() as session:
        row = await session.get(ProtocolRow, protocol_id)
        if not row:
            return None
        return row.data


async def get_all_protocols():
    async with Session() as session:
        result = await session.execute(select(ProtocolRow))
        rows = result.scalars().all()
        data = []
        for row in rows:
            data.append(row.data)
        return data
