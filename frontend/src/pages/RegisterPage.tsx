import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { appName } from '../services/api'
import { registerRequest } from '../services/auth'

export const RegisterPage = () => {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    try {
      await registerRequest({ email, password })
      setSuccess('Conta criada com sucesso. Redirecionando para login...')

      setTimeout(() => {
        navigate('/login')
      }, 1200)
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : 'Falha ao registrar usuário.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="container">
      <div className="login-wrapper">
        <div className="card p-4">
          <h1 className="h4 mb-4 text-center">
            {appName} - Criar Conta
          </h1>

          {error && <div className="alert alert-danger py-2">{error}</div>}
          {success && <div className="alert alert-success py-2">{success}</div>}

          <form onSubmit={handleSubmit} className="d-grid gap-3">
            <div>
              <label htmlFor="email" className="form-label">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                className="form-control"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="form-label">
                Senha
              </label>
              <input
                id="password"
                type="password"
                className="form-control"
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? (
                <span className="d-inline-flex align-items-center gap-2">
                  <span className="spinner-border spinner-border-sm" aria-hidden="true" />
                  Criando conta...
                </span>
              ) : 'Criar conta'}
            </button>
          </form>

          <p className="mt-4 mb-0 text-center text-secondary">
            Já tem conta? <Link to="/login">Entrar</Link>
          </p>
        </div>
      </div>
    </main>
  )
}