import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

interface AdvancedFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplyFilters: (filters: any) => void;
  existingTags?: string[]; // Tags já existentes em todos os clientes
  existingLocations?: string[];
}

export function AdvancedFilters({ open, onOpenChange, onApplyFilters, existingTags = [], existingLocations = [] }: AdvancedFiltersProps) {
  const [filters, setFilters] = useState({
    locations: [] as string[],
    budgetMin: '',
    budgetMax: '',
    tags: [] as string[],
    clientType: '',
    dateRange: {
      start: '',
      end: '',
    },
  });

  const removeTag = (tagToRemove: string) => {
    setFilters({
      ...filters,
      tags: filters.tags.filter(tag => tag !== tagToRemove),
    });
  };

  const addExistingTag = (tag: string) => {
    if (!filters.tags.includes(tag)) {
      setFilters({
        ...filters,
        tags: [...filters.tags, tag],
      });
    }
  };

  const addLocation = (location: string) => {
    if (!filters.locations.includes(location)) {
      setFilters({
        ...filters,
        locations: [...filters.locations, location],
      });
    }
  };

  const removeLocation = (locationToRemove: string) => {
    setFilters({
      ...filters,
      locations: filters.locations.filter(location => location !== locationToRemove),
    });
  };

  const handleApply = () => {
    onApplyFilters(filters);
    onOpenChange(false);
  };

  const handleClear = () => {
    setFilters({
      locations: [],
      budgetMin: '',
      budgetMax: '',
      tags: [],
      clientType: '',
      dateRange: {
        start: '',
        end: '',
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Filtros Avançados</DialogTitle>
          <DialogDescription>
            Configure filtros detalhados para encontrar clientes específicos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Locations */}
          <div className="space-y-2">
            <Label>Localização</Label>
            <Select onValueChange={addLocation}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione localizações" />
              </SelectTrigger>
              <SelectContent>
                {existingLocations.filter(location => !filters.locations.includes(location)).map((location) => (
                  <SelectItem key={location} value={location}>
                    {location}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-2">
              {filters.locations.map((location) => (
                <Badge key={location} variant="secondary" className="flex items-center gap-1">
                  {location}
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => removeLocation(location)}
                  />
                </Badge>
              ))}
            </div>
          </div>

          {/* Budget Range */}
          <div className="space-y-2">
            <Label>Faixa de Orçamento</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                placeholder="Mínimo"
                value={filters.budgetMin}
                onChange={(e) => setFilters({ ...filters, budgetMin: e.target.value })}
              />
              <Input
                type="number"
                placeholder="Máximo"
                value={filters.budgetMax}
                onChange={(e) => setFilters({ ...filters, budgetMax: e.target.value })}
              />
            </div>
          </div>

          {/* Has Organization */}
          <div className="space-y-2">
            <Label>Tipo de Cliente</Label>
            <Select value={filters.clientType} onValueChange={(value) => setFilters({...filters, clientType: value})}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fisico">Cliente Físico</SelectItem>
                {/* <SelectItem value="juridico">Cliente Jurídico</SelectItem> */}
              </SelectContent>
            </Select>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label>Tags</Label>

            <div className="space-y-3">
              {existingTags.length > 0 && (
                <div>
                  <Label className="text-sm text-muted-foreground">Selecionar de tags existentes:</Label>
                  <Select onValueChange={addExistingTag}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolher tag existente" />
                    </SelectTrigger>
                    <SelectContent>
                      {existingTags
                        .filter(tag => !filters.tags.includes(tag))
                        .map((tag) => (
                          <SelectItem key={tag} value={tag}>
                            {tag}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

            </div>

            {/* Tags selecionadas */}
            <div className="flex flex-wrap gap-2">
              {filters.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                  {tag}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => removeTag(tag)}
                  />
                </Badge>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div className="space-y-2">
            <Label>Período de Cadastro</Label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start-date">Data Inicial</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={filters.dateRange.start}
                  onChange={(e) => setFilters({
                    ...filters,
                    dateRange: { ...filters.dateRange, start: e.target.value }
                  })}
                />
              </div>
              <div>
                <Label htmlFor="end-date">Data Final</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={filters.dateRange.end}
                  onChange={(e) => setFilters({
                    ...filters,
                    dateRange: { ...filters.dateRange, end: e.target.value }
                  })}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          <Button variant="outline" onClick={handleClear}>
            Limpar Filtros
          </Button>
          <div className="space-x-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleApply}>
              Aplicar Filtros
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
