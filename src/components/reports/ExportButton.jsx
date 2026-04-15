import { Button } from "@/components/ui/button";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { format } from "date-fns";
import { sanitizeCSVCell } from "@/lib/csvSanitize";

export default function ExportButton({ summaries, franchises, startDate, endDate }) {
  const exportToCSV = () => {
    // Preparar dados para exportação
    const headers = [
      'Data',
      'Franquia',
      'Cidade',
      'Contatos Únicos',
      'Vendas',
      'Faturamento',
      'Taxa de Conversão (%)'
    ];

    const rows = summaries.map(summary => {
      const franchise = franchises.find(f => f.evolution_instance_id === summary.franchise_id);
      return [
        sanitizeCSVCell(summary.date),
        sanitizeCSVCell(franchise?.owner_name || 'N/A'),
        sanitizeCSVCell(franchise?.city || 'N/A'),
        summary.unique_contacts || 0,
        summary.sales_count || 0,
        `"R$ ${(parseFloat(summary.sales_value) || 0).toFixed(2).replace('.', ',')}"`,
        summary.conversion_rate ? parseFloat(summary.conversion_rate).toFixed(2) : '0.00'
      ];
    });

    // Criar CSV
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_vendas_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Button onClick={exportToCSV} variant="outline" className="gap-2">
      <MaterialIcon icon="download" size={16} />
      Exportar CSV
    </Button>
  );
}