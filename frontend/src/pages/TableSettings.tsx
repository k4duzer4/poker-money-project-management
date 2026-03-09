import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import api from "../services/http";

export default function TableSettings() {
  const { tableId } = useParams();
  const [name, setName] = useState("");
  const [blinds, setBlinds] = useState("");
  const [currency, setCurrency] = useState("");

  useEffect(() => {
    api.get(`/tables/${tableId}`).then(res => {
      const t = res.data.table;
      setName(t.name);
      setBlinds(t.blinds);
      setCurrency(t.currency);
    });
  }, [tableId]);

  const handleSave = async () => {
    await api.patch(`/tables/${tableId}`, { name, blinds, currency });
    alert("Mesa atualizada!");
  };

  const handleClose = async () => {
    await api.patch(`/tables/${tableId}/close`);
    alert("Mesa encerrada!");
  };

  const handleReopen = async () => {
    await api.patch(`/tables/${tableId}/reopen`);
    alert("Mesa reaberta!");
  };

  return (
    <div>
      <h1>Configurações da Mesa</h1>
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
      <button onClick={handleSave}>Salvar</button>
      <button onClick={handleClose}>Encerrar Mesa</button>
      <button onClick={handleReopen}>Reabrir Mesa</button>
    </div>
  );
}
