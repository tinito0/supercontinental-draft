import React from 'react';
import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

export default function LeagueNotFoundScreen() {
  useDocumentTitle('Página no encontrada');

  return (
    <section className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <h1 className="sr-only">Página no encontrada</h1>
      <EmptyState icon={Compass} title="Esta página no existe" description="Revisá la dirección o volvé al inicio.">
        <Link to="/" className="btn btn-primary btn-lg mt-5">Ir al inicio</Link>
      </EmptyState>
    </section>
  );
}
