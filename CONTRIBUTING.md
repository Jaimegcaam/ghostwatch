# Contributing to Ghostwatch

Thank you for your interest in contributing to Ghostwatch! We welcome contributions from the community.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/yourusername/ghostwatch.git
   cd ghostwatch
   ```
3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/jaimegcaam/ghostwatch.git
   ```

## Development Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

## Making Changes

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following our code style

3. **Test your changes**:
   ```bash
   npm run lint
   npm run test
   ```

4. **Commit with clear messages**:
   ```bash
   git commit -m "feat: add new monitoring feature"
   ```

5. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Open a Pull Request** on GitHub

## Code Style

- Use **TypeScript** for type safety
- Follow **ESLint** rules (run `npm run lint`)
- Use **Prettier** for formatting
- Keep components focused and reusable
- Add comments for non-obvious logic

## Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) format:

- `feat: add new feature`
- `fix: resolve bug`
- `docs: update documentation`
- `refactor: improve code structure`
- `test: add tests`
- `chore: maintenance tasks`

## Pull Request Process

1. Update the README.md if needed
2. Add tests for new features
3. Ensure all tests pass
4. Wait for code review
5. Address feedback if needed

## Areas for Contribution

- **Features**: New monitoring capabilities, integrations, UI improvements
- **Bugs**: Report and fix issues
- **Documentation**: Improve guides and API docs
- **Performance**: Optimize queries and components
- **Security**: Report vulnerabilities responsibly

## Reporting Bugs

Use GitHub Issues to report bugs. Include:

- Clear description of the issue
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment details

## Suggesting Enhancements

Have an idea? Open an issue with:

- Use case and motivation
- Proposed solution
- Alternative approaches
- Examples or mockups

## Questions?

- **GitHub Discussions**: Ask questions in discussions
- **Email**: support@ghostwatch.io
- **Issues**: Tag your question as `question` type

## License

By contributing to Ghostwatch, you agree that your contributions will be licensed under the MIT License.

---

Thank you for making Ghostwatch better! 🚀
