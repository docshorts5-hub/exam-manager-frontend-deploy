import { useRoomsData } from "../hooks/useRoomsData";
import { createId } from "../lib/roomScheduling";

export default function Rooms(){
  const { rooms, loading, createRoom } = useRoomsData();

  if(loading) return <div>loading...</div>;

  return (
    <div>
      <h2>Rooms</h2>
      <button onClick={()=>createRoom({
        id:createId("room"),
        roomName:"Test",
        building:"A",
        type:"class",
        capacity:30,
        notes:""
      })}>
        add
      </button>
      {rooms.map(r=><div key={r.id}>{r.roomName}</div>)}
    </div>
  );
}
