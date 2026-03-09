type PageLoaderProps = {
  message?: string;
};

export default function PageLoader({ message = 'Carregando...' }: PageLoaderProps) {
  return (
    <div className="page-loader" role="status" aria-live="polite">
      <div className="spinner-border text-success" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}
