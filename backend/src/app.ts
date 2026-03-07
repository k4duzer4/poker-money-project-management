import Fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import { corsOrigins } from './config/env';
import { authRoutes } from './modules/auth/routes';
import { playersRoutes } from './modules/players/routes';
import { tablesRoutes } from './modules/tables/routes';
import { transactionsRoutes } from './modules/transactions/routes';

export const app = Fastify({ logger: true });

app.register(cors, {
	origin: (origin, callback) => {
		if (!origin) {
			callback(null, true);
			return;
		}

		const isAllowed = corsOrigins.includes(origin);
		callback(null, isAllowed);
	},
});

app.register(swagger, {
	openapi: {
		info: {
			title: 'Poker Cash API',
			description: 'Documentacao da API do backend',
			version: '1.0.0',
		},
	},
});

app.register(swaggerUi, {
	routePrefix: '/',
	uiConfig: {
		docExpansion: 'list',
		deepLinking: false,
	},
	staticCSP: true,
	transformStaticCSP: (header) => header,
});

app.register(authRoutes, { prefix: '/auth' });
app.register(tablesRoutes, { prefix: '/tables' });
app.register(playersRoutes, { prefix: '/players' });
app.register(transactionsRoutes, { prefix: '/transactions' });
