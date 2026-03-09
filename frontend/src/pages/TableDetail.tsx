import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../services/http";

export default function TableDetail() {
  const { tableId } = useParams();
  const [table, setTable] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/tables/${tableId}`).then(res => {
      setTable(res.data.table);
      setLoading(false);
    });
  }, [tableId]);

  if (loading) return <p>Carregando...</p>;
  if (!table) return <p>Mesa não encontrada.</p>;

  return (
    <div>
      <h1>{table.name}</h1>
      <p>Status: {table.status}</p>
      <Link to={`/app/tables/${tableId}/settings`}>Configurações</Link>
    </div>
  );
}
