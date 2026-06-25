import type { Metadata } from "next";
import { LegalDocumentLayout } from "@/components/legal-document-layout";

export const metadata: Metadata = {
  title: "Termos de Uso | Minha Casa Conectada",
  description:
    "Termos e condições de uso do site e dos serviços da Minha Casa Conectada.",
};

export default function TermosPage() {
  return (
    <LegalDocumentLayout
      title="Termos de Uso"
      updatedLabel="Última atualização: 7 de maio de 2026."
    >
      <p>
        Estes Termos de Uso (&quot;Termos&quot;) regulam o acesso e a utilização do
        site, aplicativos e demais canais digitais operados pela{" "}
        <strong>MINHA CASA CONECTADA LTDA</strong>, pessoa jurídica de direito
        privado, inscrita no CNPJ sob o nº{" "}
        <strong>65.357.689/0001-51</strong>, com sede na Av. das Américas,
        17.701, Sala 0203, Rio de Janeiro/RJ, CEP 22.790-703 (&quot;Minha Casa
        Conectada&quot;, &quot;nós&quot; ou &quot;nosso&quot;), bem como os
        serviços de intermediação, comparação e comercialização de planos de
        internet banda larga oferecidos por meio desses canais.
      </p>
      <p>
        Ao utilizar nossos serviços, você (&quot;Usuário&quot; ou
        &quot;você&quot;) declara ter lido, compreendido e concordado com estes
        Termos e com a nossa{" "}
        <a href="/politica" className="font-medium text-[#0066CC] underline">
          Política de Privacidade
        </a>
        . Caso não concorde, não utilize o site nem nossos canais de contato
        para contratação ou consulta.
      </p>

      <h2>1. Objeto e natureza do serviço</h2>
      <p>
        A Minha Casa Conectada atua na intermediação e comparação de ofertas de
        internet banda larga de diferentes operadoras, com o objetivo de
        facilitar a escolha e a contratação de planos adequados ao endereço e
        às necessidades do Usuário. Somos um canal independente: não somos
        operadora de telecomunicações; a prestação do serviço de conexão, sua
        continuidade, velocidade, suporte técnico e faturamento são de
        responsabilidade da operadora contratada.
      </p>

      <h2>2. Elegibilidade e uso permitido</h2>
      <p>
        O uso do site é permitido a pessoas físicas capazes e a pessoas jurídicas
        por meio de seus representantes legais. Você compromete-se a fornecer
        informações verdadeiras, completas e atualizadas (como CEP, número do
        imóvel e dados de contato) quando solicitadas para viabilizar a
        análise de viabilidade, cotação ou contratação.
      </p>
      <p>É vedado utilizar o site para fins ilícitos, inclusive:</p>
      <ul>
        <li>
          enviar dados falsos, ofensivos ou que violem direitos de terceiros;
        </li>
        <li>
          tentar obter acesso não autorizado a sistemas, redes ou contas de
          terceiros;
        </li>
        <li>
          praticar engenharia reversa, scraping abusivo ou qualquer atividade
          que comprometa a segurança ou o funcionamento dos nossos serviços.
        </li>
      </ul>

      <h2>3. Processo de contratação e relação com a operadora</h2>
      <p>
        As informações exibidas (planos, preços, velocidades, condições
        comerciais e disponibilidade técnica) dependem de dados fornecidos pelas
        operadoras e de consultas a bases de cobertura; podem sofrer alterações
        sem aviso prévio até a confirmação formal da contratação. A contratação
        definitiva ocorre mediante aceite do Usuário junto à operadora ou por
        meio dos fluxos por nós indicados, ficando sujeita à análise de crédito,
        viabilidade técnica e documentação exigida pela operadora.
      </p>
      <p>
        Eventuais comissões ou remunerações recebidas pela Minha Casa Conectada
        em razão da intermediação não alteram o compromisso de apresentar
        opções alinhadas ao melhor interesse do Usuário, dentro das ofertas
        disponíveis para o endereço informado.
      </p>

      <h2>4. Propriedade intelectual</h2>
      <p>
        Marcas, logotipos, textos, layouts, imagens, bases de dados e demais
        conteúdos do site são de titularidade da Minha Casa Conectada ou de
        licenciantes, salvo indicação em contrário. É proibida a reprodução,
        distribuição ou modificação não autorizada para fins comerciais.
      </p>

      <h2>5. Limitação de responsabilidade</h2>
      <p>
        Na máxima extensão permitida pela lei aplicável, a Minha Casa Conectada
        não se responsabiliza por indisponibilidade temporária do site,
        interrupções de serviço de internet contratada junto à operadora,
        alterações unilaterais de preços ou condições pela operadora após a
        cotação, nem por danos indiretos, lucros cessantes ou perda de dados.
        O site e as informações são fornecidos &quot;no estado em que se
        encontram&quot;.
      </p>

      <h2>6. Links e serviços de terceiros</h2>
      <p>
        O site pode conter links para sites de operadoras ou parceiros. Não
        controlamos esses ambientes; o uso deles está sujeito aos termos e
        políticas de cada terceiro.
      </p>

      <h2>7. Privacidade</h2>
      <p>
        O tratamento de dados pessoais obedece à nossa Política de Privacidade,
        em conformidade com a Lei nº 13.709/2018 (LGPD).
      </p>

      <h2>8. Alterações dos Termos</h2>
      <p>
        Podemos atualizar estes Termos a qualquer tempo. A data da última versão
        será indicada no início do documento. O uso continuado do site após
        alterações constitui aceitação dos novos Termos, exceto quando a lei
        exigir consentimento específico.
      </p>

      <h2>9. Lei aplicável e foro</h2>
      <p>
        Estes Termos são regidos pelas leis da República Federativa do Brasil.
        Fica eleito o foro da Comarca do Rio de Janeiro/RJ para dirimir
        controvérsias, com renúncia a qualquer outro, por mais privilegiado que
        seja, salvo hipóteses em que a legislação consumerista atribua
        competência imperativa a outro foro.
      </p>

      <h2>10. Contato</h2>
      <p>
        Dúvidas sobre estes Termos podem ser encaminhadas pelos canais
        indicados no rodapé do site, incluindo telefone, WhatsApp e endereço da
        sede da Minha Casa Conectada.
      </p>
    </LegalDocumentLayout>
  );
}
