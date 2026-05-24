// ðæÐïð╗ ËÖð╣ð▒ðÁÐÇÊÖðÁ ÐéÐâð╗ÐïÊ╗Ðïð¢Ðüð░ Whyktor GSV ð║ð¥ð╝ð┐ð░ð¢ð©ÐÅÊ╗Ðï ðÁÐéðÁÐêÐéðÁÐÇËÖ.
type TitleExpectation = string | RegExp;

const ADMIN_MODULES: Array<{ launcher: string; title: TitleExpectation }> = [
  { launcher: 'Dashboard', title: 'Dashboard' },
  { launcher: 'Alunos', title: 'Alunos' },
  { launcher: 'Professores', title: 'Professores' },
  { launcher: 'Turmas', title: 'Turmas' },
  { launcher: 'Disciplinas', title: 'Disciplinas' },
  { launcher: 'Notas', title: 'Lançamento de Notas' },
  { launcher: 'Chamada', title: 'Chamada Diaria' },
  { launcher: 'Atividades', title: 'Atividades' },
  { launcher: 'Cal. Escolar', title: 'Calendário Escolar' },
  { launcher: 'Cal. Professor', title: 'Calendário do Professor' },
  { launcher: 'Horários', title: 'Módulo de Horários' },
  { launcher: 'Comunicados', title: 'Comunicados' },
  { launcher: 'Biblioteca', title: 'Biblioteca' },
  { launcher: 'Relatórios', title: /Relat[oó]rios/ },
  { launcher: 'Ocorrências', title: 'Ocorrências' },
  { launcher: 'Diário', title: 'Diário Eletrônico' },
  { launcher: 'Portal Prof.', title: /Painel Administrativo|Portal do Professor/ },
  { launcher: 'Reg. Acadêmico', title: 'Registro Acadêmico' },
  { launcher: 'Tarefas Prof.', title: 'Tarefas de Casa' },
  { launcher: 'Minhas Tarefas', title: 'Minhas Tarefas de Casa' },
  { launcher: 'Cadastro', title: 'Cadastros' },
  { launcher: 'Usuários', title: 'Gestão de Usuários' },
  { launcher: 'Configurações', title: 'Configurações' },
];

function loginAsAdminViaUi() {
  cy.loginAs('admin');
}

function expectModuleTitle(launcher: string, expectedTitle: TitleExpectation) {
  cy.get('[data-window-title]', { timeout: 30_000 }).then(($windows) => {
    const matches = $windows.filter((_, element) => {
      const windowTitle = element.getAttribute('data-window-title') || '';

      return windowTitle.includes(launcher);
    });

    expect(matches.length, `window matching ${launcher}`).to.be.greaterThan(0);

    const targetWindow = matches.last();
    cy.wrap(targetWindow).then(($window) => {
      const pageTitle = $window.find('[data-cy="page-title"]').first();
      const fallbackHeading = $window.find('h1').first();
      const titleNode = pageTitle.length > 0 ? pageTitle : fallbackHeading;
      const text = (titleNode.length > 0 ? titleNode.text() : $window.text()).trim();
      if (expectedTitle instanceof RegExp) {
        expect(text).to.match(expectedTitle);
        return;
      }

      expect(text).to.include(expectedTitle);
    });
  });
}

function openModuleByLauncher(launcher: string, expectedTitle: TitleExpectation) {
  cy.openStartMenu();
  cy.get('[data-cy="start-menu"]', { timeout: 30_000 })
    .contains('button', launcher)
    .scrollIntoView()
    .click();
  cy.get('[data-cy="page-title"]').first().scrollIntoView();
  expectModuleTitle(launcher, expectedTitle);
}

function expectHeadingText(expectedText: string | RegExp) {
  cy.get('h1', { timeout: 30_000 })
    .then(($headings) => {
      const matches = $headings.filter((_, element) => {
        const text = (element.textContent || '').trim();
        return expectedText instanceof RegExp
          ? expectedText.test(text)
          : text.includes(expectedText);
      });

      expect(matches.length, `heading matching ${String(expectedText)}`).to.be.greaterThan(0);
    });
}

function clickButtonIfPresent(label: string) {
  cy.get('body').then(($body) => {
    const button = $body
      .find('button')
      .filter((_, element) => (element.textContent || '').includes(label))
      .first();

    if (button.length > 0) {
      cy.wrap(button).scrollIntoView().click({ force: true });
    }
  });
}

function closeCurrentWindowOrDialog() {
  cy.get('body').then(($body) => {
    const backButton = $body.find('button[aria-label="Voltar para a etapa anterior"]').first();
    if (backButton.length > 0) {
      cy.wrap(backButton).click({ force: true });
      return;
    }

    const cancelButton = $body
      .find('button')
      .filter((_, element) => (element.textContent || '').trim() === 'Cancelar')
      .first();

    if (cancelButton.length > 0) {
      cy.wrap(cancelButton).click({ force: true });
      return;
    }

    const backTextButton = $body
      .find('button')
      .filter((_, element) => (element.textContent || '').includes('Voltar'))
      .first();

    if (backTextButton.length > 0) {
      cy.wrap(backTextButton).click({ force: true });
      return;
    }

    cy.get('button[title="Fechar"]').last().click({ force: true });
  });
}

function closeTopWindow() {
  cy.get('body').then(($body) => {
    const closeButton = $body
      .find('button[title="Fechar"], button[aria-label="Fechar"], [data-window-id] button[title="Fechar"]')
      .last();

    if (closeButton.length > 0) {
      cy.wrap(closeButton).click({ force: true });
      return;
    }

    const backButton = $body.find('button[aria-label="Voltar para a etapa anterior"]').first();
    if (backButton.length > 0) {
      cy.wrap(backButton).click({ force: true });
      return;
    }

    cy.get('body').type('{esc}');
  });
}

function assertStartMenuHidesRestrictedApps() {
  cy.openStartMenu();
  cy.get('[data-cy="start-menu"]')
    .contains('button', 'Portal Resp.')
    .should('not.exist');
  cy.get('[data-cy="start-menu"]')
    .contains('button', 'Metas')
    .should('not.exist');
  cy.closeStartMenu();
}

describe('Project WG - automação completa do admin', () => {
  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    loginAsAdminViaUi();
    assertStartMenuHidesRestrictedApps();
  });

  it('cobre os módulos administrativos e seus principais botões', () => {
    openModuleByLauncher('Dashboard', 'Dashboard');
    clickButtonIfPresent('Novo Aluno');
    cy.get('body').then(($body) => {
      const titleText = $body.find('[data-cy="page-title"]').first().text().trim();

      if (titleText.includes('Matrícula de Aluno')) {
        closeTopWindow();
        expectModuleTitle('Dashboard', 'Dashboard');
      }
    });

    openModuleByLauncher('Alunos', 'Alunos');
    clickButtonIfPresent('Novo Aluno');
    expectHeadingText('Matrícula de Aluno');
    closeTopWindow();
    expectModuleTitle('Alunos', 'Alunos');

    clickButtonIfPresent('Importar CSV/Excel');
    closeCurrentWindowOrDialog();

    openModuleByLauncher('Professores', 'Professores');
    clickButtonIfPresent('+ Novo Professor');
    expectHeadingText('Novo Professor');
    closeCurrentWindowOrDialog();
    expectModuleTitle('Professores', 'Professores');
    clickButtonIfPresent('Importar CSV/Excel');
    closeCurrentWindowOrDialog();

    openModuleByLauncher('Turmas', 'Turmas');
    clickButtonIfPresent('Nova Turma');
    expectHeadingText('Nova Turma');
    closeCurrentWindowOrDialog();
    expectModuleTitle('Turmas', 'Turmas');

    openModuleByLauncher('Disciplinas', 'Disciplinas');
    clickButtonIfPresent('Nova Disciplina');
    expectHeadingText('Nova Disciplina');
    closeCurrentWindowOrDialog();
    expectModuleTitle('Disciplinas', 'Disciplinas');

    openModuleByLauncher('Atividades', 'Atividades');
    clickButtonIfPresent('Nova Atividade');
    expectHeadingText('Nova Atividade');
    closeCurrentWindowOrDialog();
    expectModuleTitle('Atividades', 'Atividades');

    openModuleByLauncher('Comunicados', 'Comunicados');
    clickButtonIfPresent('Novo Comunicado');
    expectHeadingText('Novo Comunicado');
    closeCurrentWindowOrDialog();
    expectModuleTitle('Comunicados', 'Comunicados');

    openModuleByLauncher('Biblioteca', 'Biblioteca');
    clickButtonIfPresent('Novo Item');
    expectHeadingText('Novo Item');
    closeCurrentWindowOrDialog();
    expectModuleTitle('Biblioteca', 'Biblioteca');
    clickButtonIfPresent('Novo Empréstimo');
    expectHeadingText('Novo Empréstimo');
    closeCurrentWindowOrDialog();
    expectModuleTitle('Biblioteca', 'Biblioteca');

    openModuleByLauncher('Ocorrências', 'Ocorrências');
    clickButtonIfPresent('Nova Ocorrência');
    expectHeadingText('Nova ocorrência');
    closeCurrentWindowOrDialog();
    expectModuleTitle('Ocorrências', 'Ocorrências');

    openModuleByLauncher('Diário', 'Diário Eletrônico');
    clickButtonIfPresent('Nova Aula');
    expectHeadingText('Registrar Nova Aula');
    closeCurrentWindowOrDialog();
    expectModuleTitle('Diário', 'Diário Eletrônico');
    clickButtonIfPresent('Novo Plano de Aula');
    expectHeadingText('Novo Plano de Aula');
    closeCurrentWindowOrDialog();
    expectModuleTitle('Diário', 'Diário Eletrônico');

    openModuleByLauncher('Cal. Escolar', 'Calendário Escolar');
    clickButtonIfPresent('Novo Evento');
    expectHeadingText('Novo Evento');
    closeCurrentWindowOrDialog();
    expectModuleTitle('Cal. Escolar', 'Calendário Escolar');
    clickButtonIfPresent('Próximo mês');
    clickButtonIfPresent('Mês anterior');

    openModuleByLauncher('Cal. Professor', 'Calendário do Professor');
    clickButtonIfPresent('Novo Evento');
    expectHeadingText('Novo Evento');
    closeCurrentWindowOrDialog();
    expectModuleTitle('Cal. Professor', 'Calendário do Professor');
    clickButtonIfPresent('Exportar');
    clickButtonIfPresent('Sincronizar calendário externo');

    openModuleByLauncher('Relatórios', /Relat[oó]rios/);
    clickButtonIfPresent('Exportar cadastro em PDF');

    openModuleByLauncher('Reg. Acadêmico', 'Registro Acadêmico');
    clickButtonIfPresent('Salvar Notas');
    clickButtonIfPresent('Salvar Frequência');

    openModuleByLauncher('Notas', 'Lançamento de Notas');
    clickButtonIfPresent('Salvar notas');

    openModuleByLauncher('Chamada', 'Chamada Diaria');
    clickButtonIfPresent('Salvar Chamada');

    openModuleByLauncher('Portal Prof.', /Painel Administrativo|Portal do Professor/);
    cy.contains('button', 'Visão Geral').click({ force: true });
    cy.contains('button', 'Desempenho').click({ force: true });
    cy.contains('button', 'Engajamento').click({ force: true });
    cy.contains('button', 'Comunicação').click({ force: true });

    openModuleByLauncher('Usuários', 'Gestão de Usuários');
    clickButtonIfPresent('Novo Usuário');
    expectHeadingText('Cadastro de Usuário');
    closeTopWindow();
    expectModuleTitle('Usuários', 'Gestão de Usuários');

    openModuleByLauncher('Cadastro', 'Cadastros');
    clickButtonIfPresent('Nova Matrícula de Aluno');
    expectHeadingText('Matrícula de Aluno');
    clickButtonIfPresent('Voltar');
    expectModuleTitle('Cadastro', 'Cadastros');

    clickButtonIfPresent('Cadastro de Usuário do Sistema');
    expectHeadingText('Cadastro de Usuário');
    cy.contains('button', 'Gestão').click({ force: true });
    cy.contains('button', 'Coordenador').click({ force: true });
    cy.contains('button', 'Continuar').click({ force: true });
    expectHeadingText('Cadastro de Usuário');
    clickButtonIfPresent('Voltar');
    expectModuleTitle('Cadastro', 'Cadastros');

    openModuleByLauncher('Configurações', 'Configurações');
    cy.contains('button', 'Exportação').click({ force: true });
    cy.get('button[aria-label^="Selecionar a cor"]').first().click({ force: true });
    cy.get('button[aria-label="Ativar ou desativar tooltips dos botões"], [data-tooltip="Alternar rapidamente o estado dos tooltips"]')
      .first()
      .click({ force: true });
    clickButtonIfPresent('Exportar sistema em Excel');
    cy.get('[role="combobox"]').last().click({ force: true });
    cy.contains('[role="option"]', 'Alunos').click({ force: true });
    clickButtonIfPresent('Exportar modulo em CSV');
    clickButtonIfPresent('Salvar Configuracoes');
  });
});

export {};
