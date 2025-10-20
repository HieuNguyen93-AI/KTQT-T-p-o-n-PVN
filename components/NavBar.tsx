import React from 'react';

interface NavBarProps {
    navItems: string[];
    activeItem: string;
    setActiveItem: (item: string) => void;
}

const NavBar: React.FC<NavBarProps> = ({ navItems, activeItem, setActiveItem }) => {

    return (
        <div className="flex items-center bg-white rounded-lg shadow p-2 space-x-1">
            <nav className="flex-grow">
                <ul className="flex items-center space-x-1 overflow-x-auto">
                    {navItems.map(item => (
                        <li key={item}>
                            <button
                                onClick={() => setActiveItem(item)}
                                className={`px-3 py-2 text-sm font-semibold rounded-md whitespace-nowrap transition-colors duration-200 ${
                                    activeItem === item
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            >
                                {item}
                            </button>
                        </li>
                    ))}
                </ul>
            </nav>
        </div>
    );
};

export default NavBar;