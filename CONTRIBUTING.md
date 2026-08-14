# Contributing

Thanks for your interest in `dsh-provider-usage`.

## Development

```sh
npm test
```

The package is plain ESM JavaScript, no build step. The plugin entry is
`lib/index.js` (Host) and `lib/client.js` (Web client). Keep pure parsing and
formatting helpers in `lib/provider-usage.js` so they stay unit-testable.

## Pull Requests

- Keep changes focused and explain the motivation in the description.
- Add or update tests in `test/` for any behavior change.
- Run `npm test` before submitting.

## License

By contributing you agree that your contributions are licensed under the
[MIT License](LICENSE).
