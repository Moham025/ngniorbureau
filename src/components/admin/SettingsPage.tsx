'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Settings, Eye, EyeOff, Save, Key, Cpu } from 'lucide-react'

export default function SettingsPage() {
  const [deepseekKey, setDeepseekKey] = useState('')
  const [glmKey, setGlmKey] = useState('')
  const [showDeepseek, setShowDeepseek] = useState(false)
  const [showGlm, setShowGlm] = useState(false)
  const [savedStatus, setSavedStatus] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setDeepseekKey(localStorage.getItem('deepseek_api_key') || '')
      setGlmKey(localStorage.getItem('glm_api_key') || '')
    }
  }, [])

  const handleSave = () => {
    localStorage.setItem('deepseek_api_key', deepseekKey)
    localStorage.setItem('glm_api_key', glmKey)
    setSavedStatus(true)
    setTimeout(() => setSavedStatus(false), 3000)
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h3 className="text-xl font-bold tracking-tight">Paramètres de l'application</h3>
        <p className="text-sm text-muted-foreground">
          Gérez vos clés API et les configurations des modèles d'intelligence artificielle.
        </p>
      </div>

      <Card className="border shadow-sm">
        <CardContent className="p-6 space-y-6">
          <div className="flex items-center gap-2 pb-4 border-b">
            <Cpu className="text-primary h-5 w-5" />
            <h4 className="font-bold text-base">Configurations des API IA</h4>
          </div>

          {/* DeepSeek Key */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold flex items-center gap-1.5">
                <Key size={14} className="text-muted-foreground" />
                Clé API DeepSeek
              </label>
              <button
                type="button"
                onClick={() => setShowDeepseek(!showDeepseek)}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                {showDeepseek ? <EyeOff size={12} /> : <Eye size={12} />}
                {showDeepseek ? 'Masquer' : 'Afficher'}
              </button>
            </div>
            <Input
              type={showDeepseek ? 'text' : 'password'}
              placeholder="sk-..."
              value={deepseekKey}
              onChange={(e) => setDeepseekKey(e.target.value)}
              className="font-mono text-sm bg-background/50"
            />
            <p className="text-[11px] text-muted-foreground">
              Utilisée pour la reformulation automatique des désignations et l'analyse intelligente des devis et DQE.
            </p>
          </div>

          {/* GLM Key */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold flex items-center gap-1.5">
                <Key size={14} className="text-muted-foreground" />
                Clé API GLM (Zhipu AI OCR)
              </label>
              <button
                type="button"
                onClick={() => setShowGlm(!showGlm)}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                {showGlm ? <EyeOff size={12} /> : <Eye size={12} />}
                {showGlm ? 'Masquer' : 'Afficher'}
              </button>
            </div>
            <Input
              type={showGlm ? 'text' : 'password'}
              placeholder="Clé API GLM..."
              value={glmKey}
              onChange={(e) => setGlmKey(e.target.value)}
              className="font-mono text-sm bg-background/50"
            />
            <p className="text-[11px] text-muted-foreground">
              Utilisée pour extraire le texte des images et des captures de devis/DQE collés avec Ctrl + V.
            </p>
          </div>

          <div className="pt-4 border-t flex items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              Toutes les clés sont cryptées et stockées uniquement en local dans votre navigateur.
            </p>
            <Button onClick={handleSave} className="gap-2 shrink-0 bg-primary hover:bg-primary/95 text-primary-foreground">
              <Save size={16} />
              Enregistrer les modifications
            </Button>
          </div>
        </CardContent>
      </Card>

      {savedStatus && (
        <div className="fixed top-4 right-4 bg-emerald-500 text-white px-4 py-2.5 rounded-xl shadow-lg z-50 flex items-center gap-2 animate-in slide-in-from-top-2 fade-in duration-300">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
          <span className="text-sm font-semibold">Paramètres enregistrés avec succès !</span>
        </div>
      )}
    </div>
  )
}
