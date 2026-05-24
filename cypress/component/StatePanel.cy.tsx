import React from 'react';
import StatePanel from '../../src/components/common/StatePanel';

describe('StatePanel', () => {
  it('renderiza o estado de erro com ação clicável', () => {
    const onAction = cy.stub().as('onAction');

    cy.mount(
      <StatePanel
        variant="error"
        title="Falha ao carregar dados"
        description="Tente novamente em alguns instantes."
        actionLabel="Recarregar"
        onAction={onAction}
      />
    );

    cy.get('[role="alert"]').should('be.visible');
    cy.contains('Erro').should('be.visible');
    cy.contains('Falha ao carregar dados').should('be.visible');
    cy.contains('Tente novamente em alguns instantes.').should('be.visible');
    cy.contains('button', 'Recarregar').click();
    cy.get('@onAction').should('have.been.calledOnce');
  });

  it('renderiza o estado de carregamento com role de status', () => {
    cy.mount(
      <StatePanel
        variant="loading"
        title="Carregando painel"
        description="Isso pode levar alguns segundos."
        compact
      />
    );

    cy.get('[role="status"]').should('be.visible');
    cy.contains('Carregando').should('be.visible');
    cy.contains('Carregando painel').should('be.visible');
    cy.contains('Isso pode levar alguns segundos.').should('be.visible');
  });
});
