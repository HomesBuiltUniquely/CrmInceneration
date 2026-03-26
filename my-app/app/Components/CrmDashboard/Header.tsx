import Image from 'next/image';
import AnalyticsBar from './AnalyticsBar';
import LeadFilters from './LeadFilters';
import Milestones from './Milestones';
import MilestonePaths from './MilestonePaths';
import InsightsStrip from './InsightsStrip';

export default function Header() {
    return (
        <div className="">
            <div className="xl:grid xl:grid-cols-8 xl:h-screen xl:w-screen">
                <div className="xl:col-span-2 xl:bg-white xl:border-r xl:border-gray-300"></div>
                <div className="xl:col-span-6 bg-white">
                    <div className=" xl:h-16 xl:w-full xl:px-4 xl:shadow-md  xl:justify-between xl:flex">
                        <div className='xl:items-center xl:flex xl:pt-2'>
                        <div><Image src="/HowsCrmLogo.png" alt="Description" width={50} height={50} /></div>
                        <h1 className="xl:font-bold xl:pl-3 text-black">Lead Journey<span className="xl:text-blue-400 xl:font-bold xl:pl-4">Simplified</span></h1>
                        </div>
                        <div className='xl:items-center xl:flex'>
                            <div className='xl:mr-4 xl:w-25 xl:h-7.5 xl:bg-gray-200 xl:text-gray-500 xl:font-bold xl:rounded-lg xl:pl-4.5 xl:pt-1'>
                            Q3 FY24
                            </div>
                            <h1 className='xl:font-bold xl:pr-4 xl:text-black'>Global Sales</h1>
                            <div className='w-10 h-10 xl:rounded-full bg-gray-200'></div>
                        </div>
                    </div>
                    <div>
                        <LeadFilters/>
                        <AnalyticsBar/>
                        <Milestones/>
                        <MilestonePaths/>
                        <InsightsStrip/>
                    </div>
                </div>
            </div>
        </div>
    );
}