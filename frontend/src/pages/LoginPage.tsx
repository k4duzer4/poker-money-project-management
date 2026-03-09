import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { appName } from '../services/api'
import { loginRequest } from '../services/auth'
import { useAuthStore } from '../stores/authStore'

export const LoginPage = () => {
  const navigate = useNavigate()
  const signIn = useAuthStore((state) => state.signIn)
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
      const response = await loginRequest({ email, password })
      await signIn(response.token)
      setSuccess('Login realizado com sucesso.')

      setTimeout(() => {
        navigate('/app')
      }, 600)
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : 'Falha ao fazer login.'
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
            {appName} - Login
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
                  Entrando...
                </span>
              ) : 'Entrar'}
            </button>
          </form>

          <p className="mt-4 mb-0 text-center text-secondary">
            Não tem conta? <Link to="/register">Criar conta</Link>
          </p>
        </div>
      </div>
    </main>
  )
}