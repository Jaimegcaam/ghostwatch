# SECURITY.md

## Security Policy

### Reporting a Vulnerability

If you discover a security vulnerability in Ghostwatch, **please email us at jaimegcaam@gmail.com** instead of using the public issue tracker.

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if available)

We will acknowledge your report within 48 hours and work with you to develop and release a fix.

### Security Considerations

When self-hosting Ghostwatch, keep in mind:

1. **HTTPS**: Always use HTTPS in production
2. **Database**: Use strong passwords and network isolation for PostgreSQL
3. **Secrets**: Generate `AUTH_SECRET` and `CRON_SECRET` with `openssl rand -base64 32`
4. **Environment Variables**: Never commit `.env` files to version control
5. **Updates**: Keep Node.js and dependencies up to date
6. **Access Control**: Keep `SELF_HOSTED=true` so the dashboard stays invite-only

### Disclosure Policy

- We will coordinate disclosure with you
- We ask for 90 days to fix critical issues before public disclosure
- We will credit you in the security advisory if desired

### Supported Versions

We provide security updates for:
- The latest major version
- The previous major version (for 6 months)

---

Thank you for helping keep Ghostwatch secure.
