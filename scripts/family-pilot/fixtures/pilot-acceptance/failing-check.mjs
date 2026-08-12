process.stdout.write(JSON.stringify({ ready: false, detail: 'fixture check failed on purpose' }))
process.exitCode = 1
