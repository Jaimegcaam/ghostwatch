{{/* Expand the name of the chart. */}}
{{- define "ghostwatch.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/* Create a fully qualified app name. */}}
{{- define "ghostwatch.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{- define "ghostwatch.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/* Common labels */}}
{{- define "ghostwatch.labels" -}}
helm.sh/chart: {{ include "ghostwatch.chart" . }}
{{ include "ghostwatch.selectorLabels" . }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{/* Selector labels */}}
{{- define "ghostwatch.selectorLabels" -}}
app.kubernetes.io/name: {{ include "ghostwatch.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{/* Postgres service name */}}
{{- define "ghostwatch.postgresFullname" -}}
{{- printf "%s-postgres" (include "ghostwatch.fullname" .) -}}
{{- end -}}

{{/* Name of the secret to use (existing or chart-managed). */}}
{{- define "ghostwatch.secretName" -}}
{{- if .Values.existingSecret -}}
{{- .Values.existingSecret -}}
{{- else -}}
{{- printf "%s-secrets" (include "ghostwatch.fullname" .) -}}
{{- end -}}
{{- end -}}

{{/* Computed DATABASE_URL (bundled postgres or external). */}}
{{- define "ghostwatch.databaseUrl" -}}
{{- if .Values.postgres.enabled -}}
{{- printf "postgresql://%s:%s@%s:5432/%s?schema=public" .Values.postgres.user .Values.postgres.password (include "ghostwatch.postgresFullname" .) .Values.postgres.database -}}
{{- else -}}
{{- required "externalDatabase.url is required when postgres.enabled=false" .Values.externalDatabase.url -}}
{{- end -}}
{{- end -}}

{{/* Effective image tag. */}}
{{- define "ghostwatch.imageTag" -}}
{{- default .Chart.AppVersion .Values.image.tag -}}
{{- end -}}
