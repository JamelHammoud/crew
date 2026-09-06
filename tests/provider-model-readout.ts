import { builtinProviders } from '../src/runner/providers/detect'

for (const provider of builtinProviders) {
  const installed = await provider.detect()
  const model = provider.fields().find(field => field.key === 'model')
  console.log(
    JSON.stringify({ provider: provider.name, installed, models: model?.options?.map(option => option.value) ?? [] })
  )
}
