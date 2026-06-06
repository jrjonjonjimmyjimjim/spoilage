import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	plugins: [react(), tailwindcss()],
	root: './frontend', // TODO: what is root doing here?
	build: {
		outDir: '../static',
		emptyOutDir: true,
	},
	server: {
		proxy: {
			'/api': 'http://localhost:8080',
		},
	},
});
