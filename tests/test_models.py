import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Use a temporary SQLite database file for tests
os.environ["DATABASE_URL"] = "sqlite:///./test.db"

from backend.database import DatabaseManager, get_db_session, Agent, ChatMessage

# Ensure fresh database
DatabaseManager.reset_db()

def test_agent_creation_and_query():
    with get_db_session() as db:
        agent = Agent.create(
            db,
            name="Agent One",
            description="Test agent",
            specialization="sales",
            model="gpt-test",
            instructions="Be helpful",
        )
        agent_id = agent.id

    with get_db_session() as db:
        fetched = Agent.get_by_id(db, agent_id)
        assert fetched is not None
        assert fetched.name == "Agent One"
        assert len(Agent.list(db)) == 1

def test_chat_message_creation_and_history():
    with get_db_session() as db:
        agent = Agent.create(
            db,
            name="Agent Two",
            description="",
            specialization="sales",
            model="gpt-test",
            instructions="",
        )
        agent_id = agent.id
        session_id = "sess1"
        ChatMessage.create(
            db,
            agent_id=agent_id,
            session_id=session_id,
            user_id="u1",
            role="user",
            content="Olá",
        )
        ChatMessage.create(
            db,
            agent_id=agent_id,
            session_id=session_id,
            user_id=None,
            role="assistant",
            content="Oi",
        )

    with get_db_session() as db:
        messages = ChatMessage.get_messages(db, agent_id, session_id, asc=True)
        roles = [m.role for m in messages]
        assert roles == ["user", "assistant"]
