import { useState } from 'react'
import { Link } from 'react-router-dom'
import { appName } from '../services/api'
import { useAuthStore } from '../stores/authStore'

export const LandingPage = () => {
  const user = useAuthStore((state) => state.user)
  const token = useAuthStore((state) => state.token)
  const signOut = useAuthStore((state) => state.signOut)
  const isAuthenticated = Boolean(token)
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false)

  const handleOpenLogoutModal = () => {
    setIsLogoutModalOpen(true)
  }

  const handleCloseLogoutModal = () => {
    setIsLogoutModalOpen(false)
  }

  const handleConfirmLogout = () => {
    signOut()
    setIsLogoutModalOpen(false)
  }

  return (
    <main className="landing">
      <div className="animated-bg"></div>

      <div className="landing-shell">
        <header className="landing-header">
          <div className="landing-logo">
            {appName} <span className="badge-free">100% Gratuito</span>
          </div>

          <div className="landing-actions">
            {isAuthenticated ? (
              <>
                <span className="btn btn-outline-secondary" role="status" aria-label="Perfil do usuário">
                  Perfil{user?.email ? ` (${user.email})` : ''}
                </span>
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={handleOpenLogoutModal}
                >
                  Sair
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn-outline-secondary">
                  Login
                </Link>
                <Link to="/register" className="btn btn-primary">
                  Criar Conta
                </Link>
              </>
            )}
          </div>
        </header>

        <section className="landing-hero">
          <div className="hero-copy">
            <h1>Transforme sua Mesa de Poker em um Sistema Profissional</h1>
            <p>
              Chega de anotações confusas, cálculos manuais e discussões sobre saldo.
              O Chipz automatiza o controle de buy-ins, lucros e saldos em tempo real.
            </p>
            <div className="hero-cta-group">
              {isAuthenticated ? (
                <Link to="/app/tables" className="btn btn-primary btn-lg">
                  Gerenciar mesa
                </Link>
              ) : (
                <>
                  <Link to="/register" className="btn btn-primary btn-lg">
                    Criar Conta Gratuitamente
                  </Link>
                  <Link to="/login" className="btn btn-outline-secondary btn-lg">
                    Já tenho conta
                  </Link>
                </>
              )}
            </div>
          </div>

          <div className="hero-panel glass">
            <h3>Controle total da mesa</h3>
            <ul>
              <li>Registro simples de buy-ins e cash-outs</li>
              <li>Apuração automática de lucro e prejuízo</li>
              <li>Saldos atualizados em tempo real</li>
            </ul>
          </div>
        </section>

        <section className="stats">
          <div className="stat-card">
            <h2>+2.500</h2>
            <p>Partidas Registradas</p>
          </div>
          <div className="stat-card">
            <h2>+1.200</h2>
            <p>Usuários Ativos</p>
          </div>
          <div className="stat-card">
            <h2>99%</h2>
            <p>Precisão nos Cálculos</p>
          </div>
        </section>

        <section className="problem">
          <h2>O Problema</h2>
          <p>
            Em mesas caseiras, o controle financeiro vira confusão. Quem pagou?
            Quem está devendo? Quem ganhou mais no mês?
          </p>
        </section>

        <section className="solution">
          <h2>A Solução</h2>
          <div className="solution-grid">
            <article className="feature-card">
              <h4>Controle Automático</h4>
              <p>O sistema calcula tudo para você, instantaneamente.</p>
            </article>
            <article className="feature-card">
              <h4>Saldo por Jogador</h4>
              <p>Visualize facilmente quanto cada jogador está devendo ou recebendo.</p>
            </article>
            <article className="feature-card">
              <h4>Histórico Completo</h4>
              <p>Relatórios organizados para analisar desempenho.</p>
            </article>
          </div>
        </section>

        <section className="testimonials">
          <h2>O que estão dizendo</h2>
          <div className="testimonial-grid">
            <article className="testimonial-card">
              <p>"Finalmente paramos de discutir saldo na mesa."</p>
              <span>— Carlos M.</span>
            </article>
            <article className="testimonial-card">
              <p>"Parece um sistema profissional de cassino."</p>
              <span>— Eduardo S.</span>
            </article>
            <article className="testimonial-card">
              <p>"Mudou completamente nossa organização."</p>
              <span>— Rafael T.</span>
            </article>
          </div>
        </section>

        <section className="faq">
          <h2>Perguntas Frequentes</h2>
          <div className="faq-list">
            <article className="faq-item">
              <h4>É realmente gratuito?</h4>
              <p>Sim. O sistema é 100% gratuito para uso pessoal.</p>
            </article>
            <article className="faq-item">
              <h4>Posso usar no celular?</h4>
              <p>Sim, o sistema é totalmente responsivo.</p>
            </article>
          </div>
        </section>

        <section className="landing-cta">
          <h2>Pronto para organizar sua mesa?</h2>
          <p>Comece em minutos e tenha clareza total dos resultados da sua mesa.</p>
          {isAuthenticated ? (
            <Link to="/app/tables" className="btn btn-primary btn-lg">
              Gerenciar mesa
            </Link>
          ) : (
            <Link to="/register" className="btn btn-primary btn-lg">
              Começar Agora
            </Link>
          )}
        </section>

        <footer className="landing-footer">
          © 2026 {appName}. Sistema de Gestão para Mesas de Poker.
        </footer>
      </div>

      {isLogoutModalOpen && (
        <>
          <div className="modal fade show" style={{ display: 'block' }} tabIndex={-1} role="dialog" aria-modal="true">
            <div className="modal-dialog modal-dialog-centered" role="document">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Confirmar saída</h5>
                  <button type="button" className="btn-close" aria-label="Close" onClick={handleCloseLogoutModal}></button>
                </div>
                <div className="modal-body">
                  <p className="mb-0">Deseja realmente sair da sua conta?</p>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline-secondary" onClick={handleCloseLogoutModal}>
                    Cancelar
                  </button>
                  <button type="button" className="btn btn-primary" onClick={handleConfirmLogout}>
                    Sair
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show"></div>
        </>
      )}
    </main>
  )
}