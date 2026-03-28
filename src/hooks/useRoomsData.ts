import { useEffect, useState } from "react";
import { loadRooms, saveRooms } from "../services/rooms.service";
import type { Room } from "../entities/room/model";

export function useRoomsData() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRooms().then(r => {
      setRooms(r);
      setLoading(false);
    });
  }, []);

  const createRoom = async (room: Room) => {
    const next = [...rooms, room];
    setRooms(next);
    await saveRooms(next);
  };

  return { rooms, loading, createRoom };
}
