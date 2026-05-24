import React from 'react';

describe('Component smoke', () => {
  it('monta um elemento simples', () => {
    cy.mount(<div data-cy="component-smoke">ok</div>);

    cy.get('[data-cy="component-smoke"]').should('contain.text', 'ok');
  });
});
