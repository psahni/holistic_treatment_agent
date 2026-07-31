import redis
import json
from config import get_settings
from typing import Optional, Dict, Any

class SessionStore:
    def __init__(self):
        settings = get_settings()
        self.fallback_store = {}
        try:
            self.client = redis.from_url(settings.REDIS_URL)
            self.use_redis = True
        except Exception:
            self.use_redis = False
        self.ttl = 3600  # 1 hour session TTL
    
    def save_session(self, session_id: str, state: dict) -> None:
        if self.use_redis:
            try:
                self.client.setex(f"session:{session_id}", self.ttl, json.dumps(state))
            except Exception:
                self.use_redis = False
                self.fallback_store[session_id] = state
        else:
            self.fallback_store[session_id] = state
            
    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        if self.use_redis:
            try:
                data = self.client.get(f"session:{session_id}")
                if data:
                    return json.loads(data)
                return None
            except Exception:
                self.use_redis = False
                return self.fallback_store.get(session_id)
        else:
            return self.fallback_store.get(session_id)
            
    def delete_session(self, session_id: str) -> None:
        if self.use_redis:
            try:
                self.client.delete(f"session:{session_id}")
            except Exception:
                self.use_redis = False
                if session_id in self.fallback_store:
                    del self.fallback_store[session_id]
        else:
            if session_id in self.fallback_store:
                del self.fallback_store[session_id]
                
    def update_session(self, session_id: str, updates: dict) -> dict:
        state = self.get_session(session_id) or {}
        state.update(updates)
        self.save_session(session_id, state)
        return state
        
    def session_exists(self, session_id: str) -> bool:
        if self.use_redis:
            try:
                return bool(self.client.exists(f"session:{session_id}"))
            except Exception:
                self.use_redis = False
                return session_id in self.fallback_store
        else:
            return session_id in self.fallback_store

session_store = SessionStore()
