import type { Metadata } from "next";
import { LegalDocumentLayout } from "@/components/legal-document-layout";

export const metadata: Metadata = {
  title: "Política de Privacidade | Minha Casa Conectada",
  description:
    "Como a Minha Casa Conectada trata dados pessoais em conformidade com a LGPD.",
};

export default function PoliticaPage() {
  return (
    <LegalDocumentLayout
      title="Política de Privacidade"
      updatedLabel="Última atualização: 7 de maio de 2026."
    >
      <p>
        A <strong>MINHA CASA CONECTADA LTDA</strong> (&quot;Minha Casa
        Conectada&quot;, &quot;nós&quot;), CNPJ{" "}
        <strong>65.357.689/0001-51</strong>, com sede na Av. das Américas,
        17.701, Sala 0203, Rio de Janeiro/RJ, CEP 22.790-703, respeita a sua
        privacidade e trata dados pessoais em conformidade com a Lei nº
        13.709/2018 (Lei Geral de Proteção de Dados Pessoais — LGPD).
      </p>
      <p>
        Esta Política descreve quais dados coletamos, para quais finalidades, com
        quem compartilhamos e quais são os seus direitos. Recomendamos também a
        leitura dos nossos{" "}
        <a href="/termos" className="font-medium text-[#0066CC] underline">
          Termos de Uso
        </a>
        .
      </p>

      <h2>1. Controlador</h2>
      <p>
        O controlador dos dados pessoais tratados no âmbito deste site e dos
        serviços de comparação e intermediação de planos de internet é a Minha
        Casa Conectada, nos termos acima.
      </p>

      <h2>2. Dados que podemos coletar</h2>
      <p>Dependendo da sua interação conosco, podemos tratar, entre outros:</p>
      <ul>
        <li>
          <strong>Dados de localização do serviço:</strong> CEP, número do
          imóvel e informações derivadas de consultas de viabilidade;
        </li>
        <li>
          <strong>Dados de identificação e contato:</strong> nome, e-mail,
          telefone, WhatsApp, documentos quando necessários à contratação ou à
          prevenção a fraudes;
        </li>
        <li>
          <strong>Dados de navegação:</strong> endereço IP, data e hora de
          acesso, páginas visitadas, tipo de dispositivo e navegador;
        </li>
        <li>
          <strong>Cookies e tecnologias similares:</strong> conforme seção 6
          abaixo.
        </li>
      </ul>

      <h2>3. Finalidades e bases legais</h2>
      <p>Tratamos dados pessoais para:</p>
      <ul>
        <li>
          Verificar cobertura e disponibilidade de planos no seu endereço e
          apresentar comparativos (execução de procedimentos preliminares
          relacionados à contratação, a seu pedido — art. 7º, V, LGPD; e/ou
          legítimo interesse — art. 7º, IX);
        </li>
        <li>
          Intermediar contato ou contratação com operadoras parceiras
          (execução de contrato ou de procedimentos preliminares — art. 7º, V);
        </li>
        <li>
          Atendimento, suporte comercial e pós-venda da intermediação (execução
          de contrato e legítimo interesse — art. 7º, V e IX);
        </li>
        <li>
          Cumprimento de obrigações legais e regulatórias, defesa em processos e
          prevenção a fraudes (art. 7º, II, VI e IX da LGPD);
        </li>
        <li>
          Melhoria da experiência no site, estatísticas agregadas e segurança da
          informação (legítimo interesse — art. 7º, IX, observado o equilíbrio
          com seus direitos).
        </li>
      </ul>

      <h2>4. Compartilhamento de dados</h2>
      <p>
        Podemos compartilhar dados com operadoras de telecomunicações e
        parceiros comerciais estritamente necessários para cotação, viabilidade
        técnica ou contratação do plano escolhido. Também poderemos
        compartilhar com prestadores de serviços que nos auxiliam em hospedagem,
        tecnologia, análise de dados ou atendimento, mediante contratos que
        exijam confidencialidade e segurança adequados.
      </p>
      <p>
        Dados poderão ser fornecidos a autoridades públicas quando houver
        determinação legal ou ordem judicial.
      </p>

      <h2>5. Transferência internacional</h2>
      <p>
        Sempre que utilizarmos ferramentas com infraestrutura fora do Brasil,
        adotaremos cláusulas contratuais ou outras garantias previstas na LGPD
        para proteção dos dados transferidos.
      </p>

      <h2>6. Cookies</h2>
      <p>
        Utilizamos cookies e tecnologias similares para manter sessões, lembrar
        preferências, medir audiência e aprimorar o site. Você pode gerenciar
        cookies nas configurações do seu navegador. O bloqueio de cookies
        essenciais pode afetar o funcionamento de partes do site.
      </p>

      <h2>7. Retenção</h2>
      <p>
        Mantemos os dados pelo tempo necessário para cumprir as finalidades
        descritas, respeitando prazos legais de guarda de registros e o prazo de
        prescrição de eventuais direitos.
      </p>

      <h2>8. Segurança</h2>
      <p>
        Adotamos medidas técnicas e administrativas aptas a proteger os dados
        pessoais contra acessos não autorizados e incidentes. Nenhum sistema é
        totalmente isento de riscos; em caso de incidente relevante, comunicaremos
        os titulares e a Autoridade Nacional de Proteção de Dados quando exigido
        pela lei.
      </p>

      <h2>9. Direitos do titular</h2>
      <p>
        Nos termos da LGPD, você pode solicitar confirmação de tratamento,
        acesso, correção, anonimização, portabilidade, eliminação de dados
        desnecessários ou tratados em desconformidade, informação sobre
        compartilhamentos e revogação do consentimento, quando aplicável.
      </p>
      <p>
        Pedidos podem ser enviados pelos canais de contato indicados no rodapé
        do site. Poderemos solicitar informações para confirmar sua identidade
        antes de atender à solicitação.
      </p>

      <h2>10. Encarregado (DPO)</h2>
      <p>
        O encarregado pelo tratamento de dados pessoais pode ser contatado
        pelos mesmos canais divulgados no rodapé, com o assunto &quot;LGPD —
        Encarregado&quot;.
      </p>

      <h2>11. Atualizações desta Política</h2>
      <p>
        Podemos atualizar esta Política para refletir mudanças legais ou nos
        nossos serviços. A data da última versão aparece no topo desta página.
      </p>
    </LegalDocumentLayout>
  );
}
