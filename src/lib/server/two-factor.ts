import type { Cookies } from '@sveltejs/kit';
import { APIError } from 'better-auth';
import QRCode from 'qrcode';
import { auth } from './auth';

/**
 * Whether the browser is mid sign-in: password accepted, 2FA code still
 * pending. better-auth sets this signed cookie (name prefixed, and
 * `__Secure-` over HTTPS) instead of a session when 2FA is on.
 */
export async function hasPendingTwoFactor(cookies: Cookies) {
	const ctx = await auth.$context;
	return Boolean(cookies.get(ctx.createAuthCookie('two_factor').name));
}

export function totpQrSvg(totpURI: string) {
	return QRCode.toString(totpURI, { type: 'svg', margin: 1 });
}

const MESSAGES: Record<string, string> = {
	INVALID_CODE: 'Código incorrecto.',
	INVALID_BACKUP_CODE: 'Código de recuperación incorrecto.',
	INVALID_PASSWORD: 'Contraseña incorrecta.',
	TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE: 'Demasiados intentos. Vuelve a iniciar sesión.',
	ACCOUNT_TEMPORARILY_LOCKED:
		'Demasiados intentos fallidos. La cuenta está bloqueada unos minutos.',
	INVALID_TWO_FACTOR_COOKIE: 'La verificación ha caducado. Vuelve a iniciar sesión.',
	SESSION_NOT_FRESH: 'Por seguridad, cierra sesión y vuelve a entrar antes de hacer este cambio.'
};

export function twoFactorErrorMessage(error: APIError) {
	const code = error.body?.code;
	return (code && MESSAGES[code]) || error.message;
}
