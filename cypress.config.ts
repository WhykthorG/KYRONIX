// Bu proje tamamen Whykthor GSV taraf─▒ndan yap─▒lm─▒┼ƒt─▒r.
import { defineConfig } from "cypress";

const defaultBaseUrl = process.env.CYPRESS_BASE_URL || "http://localhost:5173";

export default defineConfig({
  projectId: '6xao12',
  e2e: {
    baseUrl: defaultBaseUrl,
    specPattern: "cypress/e2e/**/*.cy.{js,jsx,ts,tsx}",
    supportFile: "cypress/support/e2e.ts",
    video: false,
    retries: {
      runMode: 1,
      openMode: 0,
    },
    env: {
      adminEmail: process.env.CYPRESS_ADMIN_EMAIL || "admin@escola.com",
      adminPassword: process.env.CYPRESS_ADMIN_PASSWORD || "Teste@12345",
      teacherEmail:
        process.env.CYPRESS_TEACHER_EMAIL || "maria.santos@escola.com",
      teacherPassword: process.env.CYPRESS_TEACHER_PASSWORD || "Teste@12345",
      studentEmail:
        process.env.CYPRESS_STUDENT_EMAIL || "lucas.silva@aluno.escola.com",
      studentPassword: process.env.CYPRESS_STUDENT_PASSWORD || "Teste@12345",
      coordinatorEmail:
        process.env.CYPRESS_COORDINATOR_EMAIL || "coordenador@escola.com",
      coordinatorPassword:
        process.env.CYPRESS_COORDINATOR_PASSWORD || "Teste@12345",
      secretaryEmail:
        process.env.CYPRESS_SECRETARY_EMAIL || "secretario@escola.com",
      secretaryPassword:
        process.env.CYPRESS_SECRETARY_PASSWORD || "Teste@12345",
    },
  },

  component: {
    specPattern: "cypress/component/**/*.cy.{js,jsx,ts,tsx}",
    supportFile: "cypress/support/component.ts",
    indexHtmlFile: "cypress/support/component-index.html",
    devServer: {
      framework: "react",
      bundler: "vite",
    },
  },
});
