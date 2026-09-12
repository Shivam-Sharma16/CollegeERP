import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
    // Only scan component tests, not Playwright e2e specs
    include: ['src/tests/**/*.{test,spec}.{js,jsx}'],
    exclude: ['e2e/**', 'node_modules/**'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    cors: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: false,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            if (req.headers.host) {
              proxyReq.setHeader('x-forwarded-host', req.headers.host);
            }
          });
        }
      }
    }
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'chunk-auth': [
            './src/pages/LoginPage.jsx',
            './src/pages/StudentRegisterPage.jsx',
            './src/pages/SuperadminSignupPage.jsx',
            './src/pages/UnauthorizedPage.jsx'
          ],
          'chunk-admin': [
            './src/pages/AdminDashboard.jsx',
            './src/pages/AdminHodManagement.jsx',
            './src/pages/AdminReports.jsx',
            './src/pages/AdminFeePolicy.jsx',
            './src/pages/AdminNotices.jsx',
            './src/pages/InstitutionSettings.jsx',
            './src/pages/SuperAdminManagement.jsx'
          ],
          'chunk-hod': [
            './src/pages/HodDashboard.jsx',
            './src/pages/HodManagement.jsx',
            './src/pages/HodAcademicStructure.jsx',
            './src/pages/HodTeachingAssignments.jsx'
          ],
          'chunk-faculty': [
            './src/pages/FacultyDashboard.jsx',
            './src/pages/FacultyNotesPage.jsx',
            './src/pages/FacultyMarksEntryPage.jsx',
            './src/pages/FacultySubjectAnalyticsPage.jsx',
            './src/pages/LiveAttendanceSession.jsx'
          ],
          'chunk-cc': [
            './src/pages/CcDashboard.jsx',
            './src/pages/CcWorkspace.jsx'
          ],
          'chunk-student': [
            './src/pages/StudentDashboard.jsx',
            './src/pages/StudentAttendancePage.jsx',
            './src/pages/StudentTranscriptPage.jsx',
            './src/pages/StudentFeesPage.jsx',
            './src/pages/StudentNoticesPage.jsx'
          ],
          'chunk-shared': [
            './src/pages/ProfilePage.jsx'
          ]
        }
      }
    }
  }
})
