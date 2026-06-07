import * as _ from 'lodash-es';
import ExpiredSectionItem from "./ExpiredSectionItem";

export default function ExpiredSection({ items }) {

	return (
		<>
			<h2 className="text-2xl">Expired</h2>
			<div>
				{_.map(items, (item) => <ExpiredSectionItem item={item} />)}
			</div>
		</>
	);
}
