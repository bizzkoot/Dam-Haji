# Commit Conventions and Version Management

This document outlines the standardized conventions for commit messages and version management in the Dam Haji project.

## Version Bumping Best Practices

### Current Version Check
Always check the current version before bumping:
```bash
# Check current latest tag
git tag --list --sort=-version:refname | head -5

# Check if there are any uncommitted changes
git status
```

### Version Numbering Scheme
We follow semantic versioning (SemVer): `MAJOR.MINOR.PATCH`

- **MAJOR** (v2.0.0): Breaking changes, complete UI overhauls, major feature rewrites
- **MINOR** (v1.8.0): New features, significant improvements, non-breaking additions
- **PATCH** (v1.7.3): Bug fixes, minor improvements, hotfixes

### Version Bump Process

1. **Check current version:**
   ```bash
   git tag --list --sort=-version:refname | head -1
   ```

2. **Determine bump type based on changes:**
   - **Patch bump** (v1.7.2 → v1.7.3): Bug fixes, minor UI tweaks
   - **Minor bump** (v1.7.2 → v1.8.0): New features, mobile improvements, AI enhancements
   - **Major bump** (v1.7.2 → v2.0.0): Complete rewrites, breaking changes

3. **Create and push tag:**
   ```bash
   # Example for minor version bump
   git tag v1.8.0
   git push origin v1.8.0
   
   # Or push all tags
   git push --tags
   ```

### Current Version Status
- **Latest**: v1.7.2
- **Next suggested**: v1.8.0 (due to mobile UI overhaul - significant feature improvements)

## Commit Message Format

### Structure
```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types
- **feat**: New features
- **fix**: Bug fixes
- **docs**: Documentation changes
- **style**: Code style changes (formatting, etc.)
- **refactor**: Code refactoring
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **chore**: Maintenance tasks, dependency updates

### Scopes (Optional)
- **mobile**: Mobile-specific changes
- **ai**: AI/game logic changes
- **ui**: User interface changes
- **game**: Core game mechanics
- **build**: Build system changes

### Examples

#### Good Commit Messages
```bash
feat(mobile): add responsive difficulty button selection

- Implement reactive button sizing for mobile devices
- Fix active state management for difficulty selection
- Add touch-optimized button interactions

Fixes mobile UI layout issues on small screens
```

```bash
fix(ai): resolve infinite loop in minimax algorithm

- Add depth limit check in minimax function
- Improve move evaluation for endgame scenarios
- Optimize performance for medium difficulty

Resolves #45
```

```bash
docs: add mobile UI layout analysis

- Create comprehensive mobile layout documentation
- Document responsive design patterns
- Add troubleshooting guide for mobile issues
```

#### Poor Commit Messages (Avoid)
```bash
fix stuff
update
mobile changes
wip
```

### Commit Body Guidelines

1. **Use imperative mood**: "Add feature" not "Added feature"
2. **Explain what and why**: Not just what changed, but why
3. **Keep lines under 72 characters**
4. **Reference issues**: Use "Fixes #123" or "Resolves #456"

### Breaking Changes
For breaking changes, add to footer:
```
BREAKING CHANGE: API endpoint /api/game changed to /api/v2/game
```

## Pre-Commit Checklist

Before committing:
- [ ] Code is tested and working
- [ ] No console errors or warnings
- [ ] Mobile layout tested (if applicable)
- [ ] Commit message follows conventions
- [ ] Changes are focused and atomic

## Version Tag Checklist

Before creating a version tag:
- [ ] All commits are pushed to main branch
- [ ] Version number follows SemVer
- [ ] Tag message includes changelog summary
- [ ] No breaking changes in patch releases
- [ ] Major version changes are well documented

## Release Notes Template

When creating tags, use annotated tags with release notes:
```bash
git tag -a v1.8.0 -m "Release v1.8.0: Mobile UI Overhaul

Features:
- Complete mobile layout redesign
- Reactive difficulty button system
- Visual player indicator
- Touch-optimized controls

Bug Fixes:
- Fixed difficulty selection state management
- Resolved header overflow issues
- Improved mobile responsiveness

Breaking Changes:
- None

Compatibility:
- All modern mobile browsers
- Desktop browsers (Chrome, Firefox, Safari, Edge)"
```

## Branching Strategy

- **main**: Production-ready code
- **develop**: Integration branch for features
- **feature/**: Individual feature branches
- **hotfix/**: Emergency fixes for production

## Automation Notes

Future consideration: GitHub Actions workflow for automatic version bumping based on commit message conventions (conventional commits).

---

**Last Updated**: December 2024  
**Current Version**: v1.7.2  
**Next Planned**: v1.8.0 (Mobile UI Overhaul)