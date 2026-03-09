import { useState } from "react";
import api from "../services/http";
import { useNavigate } from "react-router-dom";

export default function NewTable() {
  const [name, setName] = useState("");
  const [blinds, setBlinds] = useState("");
  const [currency, setCurrency] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data } = await api.post("/tables", { name, blinds, currency });
    navigate(`/app/tables/${data.table.id}`);
  };

  return (
    <div>
      <h1>Criar Nova Mesa</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Nome:</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label>Blinds:</label>
          <input value={blinds} onChange={(e) => setBlinds(e.target.value)} />
        </div>
        <div>
          <label>Moeda:</label>
          <input value={currency} onChange={(e) => setCurrency(e.target.value)} />
        </div>
        <button type="submit">Criar</button>
      </form>
    </div>
  );
}
