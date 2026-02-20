"use client"

import * as React from "react"
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  format,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns"
import { ptBR } from "date-fns/locale"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface DatePickerBRProps {
  value?: string // formato YYYY-MM-DD
  onChange: (date: string) => void // formato YYYY-MM-DD
  placeholder?: string
  disabled?: boolean
}

export function DatePickerBR({ value, onChange, placeholder = "Selecione uma data", disabled }: DatePickerBRProps) {
  const [currentMonth, setCurrentMonth] = React.useState<Date>(() => {
    if (value) {
      const date = new Date(value)
      return isNaN(date.getTime()) ? new Date() : date
    }
    return new Date()
  })
  const [open, setOpen] = React.useState(false)

  const selectedDate = value ? new Date(value) : undefined

  // Build month grid
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 })
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const rows = []
  let days: JSX.Element[] = []
  let day = startDate

  const handleDateSelect = (date: Date) => {
    const formattedDate = format(date, "yyyy-MM-dd")
    onChange(formattedDate)
    setOpen(false)
  }

  while (day <= endDate) {
    for (let i = 0; i < 7; i++) {
      const cloneDay = day
      const isSelected = selectedDate && isSameDay(cloneDay, selectedDate)
      const isCurrentDay = isToday(cloneDay)
      const isCurrentMonth = isSameMonth(cloneDay, monthStart)

      days.push(
        <button
          key={cloneDay.toString()}
          type="button"
          onClick={() => handleDateSelect(cloneDay)}
          className={cn(
            "h-9 w-9 text-sm rounded-md transition-colors",
            !isCurrentMonth && "text-muted-foreground/40",
            isCurrentDay && !isSelected && "bg-accent font-semibold",
            isSelected && "bg-primary text-primary-foreground hover:bg-primary",
            !isSelected && !isCurrentDay && "hover:bg-muted",
            "flex items-center justify-center"
          )}
        >
          {format(cloneDay, "d")}
        </button>
      )
      day = addDays(day, 1)
    }
    rows.push(
      <div className="grid grid-cols-7 gap-1" key={day.toString()}>
        {days}
      </div>
    )
    days = []
  }

  // Month and Year Selectors (PT-BR)
  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ]

  // Years from 1950 to current year + 10
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: currentYear - 1950 + 11 }, (_, i) => 1950 + i)

  const handleMonthChange = (monthIndex: string) => {
    const newDate = new Date(currentMonth)
    newDate.setMonth(parseInt(monthIndex))
    setCurrentMonth(newDate)
  }

  const handleYearChange = (year: string) => {
    const newDate = new Date(currentMonth)
    newDate.setFullYear(parseInt(year))
    setCurrentMonth(newDate)
  }

  // Update currentMonth when value changes externally
  React.useEffect(() => {
    if (value) {
      const date = new Date(value)
      if (!isNaN(date.getTime())) {
        setCurrentMonth(date)
      }
    }
  }, [value])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(new Date(value), "dd/MM/yyyy", { locale: ptBR }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Card className="border-0 shadow-none">
          <CardContent className="p-3">
            <div className="flex justify-between items-center mb-3 gap-2">
              {/* Seletor de Mês */}
              <Select
                value={currentMonth.getMonth().toString()}
                onValueChange={handleMonthChange}
              >
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue>{months[currentMonth.getMonth()]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {months.map((m, i) => (
                    <SelectItem key={m} value={i.toString()}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Seletor de Ano */}
              <Select
                value={currentMonth.getFullYear().toString()}
                onValueChange={handleYearChange}
              >
                <SelectTrigger className="w-[90px] h-8 text-xs">
                  <SelectValue>{currentMonth.getFullYear()}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={y.toString()}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Dias da semana em PT-BR */}
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground mb-1">
              <div>Seg</div>
              <div>Ter</div>
              <div>Qua</div>
              <div>Qui</div>
              <div>Sex</div>
              <div>Sáb</div>
              <div>Dom</div>
            </div>

            {rows}
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  )
}
