import { createTheme } from '@mui/material'

export const theme = createTheme({
  palette: {
    primary: { main: '#2e5339' },
    secondary: { main: '#8a6d3b' },
  },
  shape: { borderRadius: 8 },
  typography: {
    h1: { fontSize: '2.5rem', fontWeight: 700, lineHeight: 1.15 },
    h2: { fontSize: '2rem', fontWeight: 700, lineHeight: 1.2 },
    h3: { fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.25 },
    h4: { fontSize: '1.5rem', fontWeight: 700, lineHeight: 1.3 },
    h5: { fontSize: '1.25rem', fontWeight: 700, lineHeight: 1.35 },
    h6: { fontSize: '1.1rem', fontWeight: 700, lineHeight: 1.4 },
    subtitle1: { fontWeight: 700 },
    button: { fontWeight: 700, textTransform: 'none' },
  },
  components: {
    MuiTextField: {
      defaultProps: {
        fullWidth: true,
        size: 'small',
        variant: 'outlined',
      },
    },
    MuiButton: {
      defaultProps: {
        variant: 'outlined',
      },
    },
    MuiCard: {
      defaultProps: {
        elevation: 0,
        variant: 'outlined',
      },
      styleOverrides: {
        root: ({ theme }) => ({
          borderColor: theme.palette.divider,
        }),
      },
    },
  },
})
