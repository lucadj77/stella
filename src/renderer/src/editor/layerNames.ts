import { useMemo } from 'react'
import type { LayerNames } from '../../../shared/model/edit'
import { useI18n } from '../i18n/context'

/** Nomi dei livelli nuovi nella lingua dell'interfaccia */
export function useLayerNames(): LayerNames {
  const { t } = useI18n()
  return useMemo(
    () => ({
      text: t('layerName.text'),
      image: t('layerName.image'),
      value: t('layerName.value'),
      grid: t('layerName.grid'),
      snap: t('layerName.snap'),
      shape: t('layerName.shape'),
      sample: t('layerName.sample'),
      shapes: {
        rect: t('layerName.rect'),
        ellipse: t('layerName.ellipse'),
        polygon: t('layerName.polygon'),
        star: t('layerName.star'),
        line: t('layerName.line'),
        path: t('layerName.path')
      }
    }),
    [t]
  )
}
