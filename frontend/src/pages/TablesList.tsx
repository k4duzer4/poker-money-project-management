import { useEffect, useState } from "react";
import api from "../services/http";
import { Link } from "react-router-dom";

export default function TablesList() {
  const [tables, setTables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/tables").then(res => {
      setTables(res.data.tables);
      setLoading(false);
    });
  }, []);

  if (loading) return <p>Carregando...</p>;
  if (!tables.length) return <p>Nenhuma mesa encontrada.</p>;

  return (
    <div>
      <h1>Mesas</h1>
      <Link to="/app/tables/new">Nova mesa</Link>
      <table>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Blinds</th>
            <th>Moeda</th>
            <th>Status</th>
            <th>Criada em</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {tables.map((t) => (
            <tr key={t.id}>
              <td>{t.name}</td>
              <td>{t.blinds}</td>
              <td>{t.currency}</td>
              <td>{t.status}</td>
              <td>{t.createdAt}</td>
              <td><Link to={`/app/tables/${t.id}`}>Ver mesa</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
