import Image from 'next/image';

export default function AnalyticsBar() {
  return (
    <main>
        <div className="xl:flex xl:gap-4 xl:mt-8 xl:px-4">
            <div className="xl:w-[320px] xl:h-25 xl:bg-[var(--crm-surface)] xl:rounded-2xl xl:shadow-[var(--crm-shadow-sm)] xl:border xl:border-[var(--crm-border)] xl:flex xl:justify-between xl:relative">
                <div>
                <h1 className="xl:font-bold xl:text-[13px] xl:text-[var(--crm-accent)] xl:p-3">OVERALL CONVERSION</h1>
                <h1 className="xl:font-bold xl:text-[24px] xl:pl-4 xl:mt-3 xl:text-[var(--crm-text-primary)]">14.2%</h1>
                </div>
                <div>
                    <Image src="/increase.png" alt="Description" width={50} height={50} className="xl:absolute xl:right-6 xl:bottom-4"></Image>
                </div>

            </div>  
            <div className="xl:w-[320px] xl:h-25 xl:bg-[var(--crm-surface)] xl:rounded-2xl xl:shadow-[var(--crm-shadow-sm)] xl:border xl:border-[var(--crm-border)] xl:flex xl:justify-between xl:relative">
                <div>
                <h1 className="xl:font-bold xl:text-[13px] xl:text-[var(--crm-accent)] xl:p-3">LEAD-TO-MEETING</h1>
                <h1 className="xl:font-bold xl:text-[24px] xl:pl-4 xl:mt-3 xl:text-[var(--crm-text-primary)]">28.5% <span className='xl:text-sm xl:text-[var(--crm-success)]'>vs 27.4% last month</span></h1>
                </div>

            </div> 
            <div className="xl:w-[320px] xl:h-25 xl:bg-[var(--crm-surface)] xl:rounded-2xl xl:shadow-[var(--crm-shadow-sm)] xl:border xl:border-[var(--crm-border)] xl:flex xl:justify-between xl:relative">
                <div>
                <h1 className="xl:font-bold xl:text-[13px] xl:text-[var(--crm-accent)] xl:p-3">PIPELINE VELOCITY</h1>
                <h1 className="xl:font-bold xl:text-[24px] xl:pl-4 xl:mt-3 xl:text-[var(--crm-text-primary)]">18.4 <span className='xl:text-sm xl:text-[var(--crm-success)]'>Days</span></h1>
                </div>
                <div>
                    <Image src="/chart-down.png" alt="Description" width={50} height={50} className="xl:absolute xl:right-6 xl:bottom-4"></Image>
                </div>

            </div> 
            <div className="xl:w-[320px] xl:h-25 xl:bg-[var(--crm-surface)] xl:rounded-2xl xl:shadow-[var(--crm-shadow-sm)] xl:border xl:border-[var(--crm-border)] xl:flex xl:justify-between xl:relative">
                <div>
                <h1 className="xl:font-bold xl:text-[13px] xl:text-[var(--crm-accent)] xl:p-3">TOTAL PIPELINE VALUE</h1>
                <h1 className="xl:font-bold xl:text-[22px] xl:pl-4 xl:mt-3 xl:text-[var(--crm-text-primary)]">4.2M INR</h1>
                </div>
                <div>
                    <div className='xl:text-[10px] xl:absolute xl:right-6 xl:bottom-4 xl:w-25 xl:h-5 xl:bg-[var(--crm-success-bg)] xl:rounded-4xl xl:text-[var(--crm-success-text)] xl:font-bold xl:pt-0.5 xl:pl-2.5'>Target Exceeded</div>
                </div>

            </div> 
        </div>
    </main>
  );
}
    