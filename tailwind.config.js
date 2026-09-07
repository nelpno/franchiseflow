/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
  	extend: {
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		colors: {
  			// Paleta da marca em token. Os VALORES sao exatamente os hex que ja dominavam o
  			// codigo, para a tokenizacao nao mexer em nenhum pixel — o que ela resolve e a
  			// deriva: havia 114 hex distintos, ~45 deles variacao acidental de outro
  			// (#a80012/#ba1a1a/#d32f2f/#a01818 todos querendo ser o vermelho da marca).
  			brand: {
  				DEFAULT: '#b91c1c',
  				dark: '#991b1b',
  				gold: '#d4af37',      // fundo/borda/icone decorativo — NUNCA texto (2,10:1)
  				'gold-ink': '#775a19' // gold como TEXTO (6,44:1)
  			},
  			ink: {
  				DEFAULT: '#1b1c1d',   // texto principal
  				2: '#4a3d3d',         // secundario
  				3: '#7a6d6d',         // terciario
  				4: '#cac0c0',         // desabilitado/placeholder — nunca em icone clicavel
  				shadow: '#291715'     // so em opacidade baixa: borda e sombra dos cards
  			},
  			surface: {
  				DEFAULT: '#fbf9fa',   // fundo da pagina
  				2: '#f5f3f0',         // display read-only
  				line: '#e9e8e9'       // borda neutra
  			},
  			ok: { DEFAULT: '#16a34a', ink: '#15803d', soft: '#f0fdf4' },
  			warn: { DEFAULT: '#d4af37', ink: '#92400e', soft: '#fef3c7' },
  			err: { DEFAULT: '#dc2626', soft: '#fef2f2' },
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
}