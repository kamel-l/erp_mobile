from dataclasses import dataclass
from typing import Any, Dict


@dataclass
class ConflictResolution:
    strategy: str
    merged_item: Dict[str, Any]
    reason: str


class ConflictResolver:
    """
    Resolve conflicts between local and server records.
    Default policy: server wins.
    """

    def resolve(self, local_item: Dict[str, Any], server_item: Dict[str, Any]) -> ConflictResolution:
        local_updated = str(local_item.get("updated_at") or "")
        server_updated = str(server_item.get("updated_at") or "")

        if server_updated >= local_updated:
            return ConflictResolution(
                strategy="server_wins",
                merged_item=server_item,
                reason="Server record is newer or equal.",
            )

        return ConflictResolution(
            strategy="local_wins",
            merged_item=local_item,
            reason="Local record is newer.",
        )
