import type { FastifyReply, FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

import { env } from '../../config/env';

type JwtPayload = {
  sub?: string;
  email?: string;
};

const jwtSubSchema = z.string().uuid();
const jwtEmailSchema = z.string().email();

export const requireAuth = async (request: FastifyRequest, reply: FastifyReply) => {
  const authHeader = request.headers.authorization;

  if (!authHeader) {
    return reply.status(401).send({ message: 'Token não informado.' });
  }

  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return reply.status(401).send({ message: 'Formato de token inválido.' });
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    const parsedSub = jwtSubSchema.safeParse(decoded.sub);
    const parsedEmail = jwtEmailSchema.safeParse(decoded.email);

    if (!parsedSub.success || !parsedEmail.success) {
      return reply.status(401).send({ message: 'Token inválido.' });
    }

    request.user = {
      id: parsedSub.data,
      email: parsedEmail.data,
    };
  } catch {
    return reply.status(401).send({ message: 'Token inválido.' });
  }
};

export const authMiddleware = requireAuth;
