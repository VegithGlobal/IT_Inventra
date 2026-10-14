import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/axios';

export default function TicketDetail() {
  const { ticketNo } = useParams();
  const [ticket, setTicket] = useState(null);
  const [comment, setComment] = useState('');

  const load = () => api.get(`/tickets/${ticketNo}`).then((r) => setTicket(r.data));
  useEffect(() => { load(); }, [ticketNo]);

  const addComment = async (e) => {
    e.preventDefault();
    await api.post(`/tickets/${ticketNo}/comments`, { comment });
    setComment('');
    load();
  };

  if (!ticket) return <p>Loading...</p>;

  return (
    <div>
      <Link to="/tickets" className="text-sm text-blue-600">&larr; Back to Tickets</Link>
      <h1 className="text-2xl font-bold mt-2 mb-1">{ticket.ticket_no}</h1>
      <p className="text-gray-500 mb-6">{ticket.category} • {ticket.priority} priority • {ticket.status}</p>

      <div className="bg-white rounded-xl shadow p-5 mb-6">
        <p className="text-sm text-gray-500 mb-1">Description</p>
        <p>{ticket.description}</p>
        {ticket.asset_no && <p className="text-sm text-gray-500 mt-3">Related Asset: <span className="font-medium">{ticket.asset_no}</span></p>}
        <p className="text-sm text-gray-500 mt-1">Raised by: <span className="font-medium">{ticket.raised_by_name}</span></p>
        {ticket.assigned_to_name && <p className="text-sm text-gray-500">Assigned to: <span className="font-medium">{ticket.assigned_to_name}</span></p>}
      </div>

      <div className="bg-white rounded-xl shadow p-5">
        <h2 className="font-semibold mb-3">Comments</h2>
        <ul className="space-y-3 mb-4">
          {ticket.comments.map((c) => (
            <li key={c.id} className="border-b pb-2 text-sm">
              <span className="font-medium">{c.user_name}</span>
              <span className="text-gray-400 text-xs ml-2">{new Date(c.created_at).toLocaleString()}</span>
              <p>{c.comment}</p>
            </li>
          ))}
          {!ticket.comments.length && <p className="text-gray-400 text-sm">No comments yet</p>}
        </ul>
        <form onSubmit={addComment} className="flex gap-2">
          <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment..."
            className="border rounded-lg px-3 py-2 text-sm flex-1" required />
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">Post</button>
        </form>
      </div>
    </div>
  );
}
