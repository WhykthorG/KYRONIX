// ┌ñÏ▒┘êÏ»┘ê┘é Ïº┘è┘å Ï»┌ñÏ▒Ï¿┘êÏºÏ¬ Ï│┌ñ┘å┘ê┘ç┌¢ Ïº┘ê┘ä┘è┘ç Whyktor GSV.
import React from 'react';

describe('Component smoke', () => {
  it('monta um elemento simples', () => {
    cy.mount(<div data-cy="component-smoke">ok</div>);

    cy.get('[data-cy="component-smoke"]').should('contain.text', 'ok');
  });
});
