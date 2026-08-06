from langgraph.graph import StateGraph, END
from .state import NaturopathyState
from .nodes import (
    intake_node, qdrant_query_node, root_cause_node, 
    treatment_design_node, recommendation_node, 
    guardrail_output_node
)

def should_continue_after_intake(state: NaturopathyState) -> str:
    """After intake node runs, decide next step.

    - If emergency detected, go to guardrail.
    - If step advanced to 'root_cause' (8+ data points), proceed to analysis.
    - If no retrieved context yet, route to qdrant_query for context.
    - Otherwise, end the conversation (answer provided).
    """
    if state.get('emergency_detected'):
        return 'guardrail'

    step = state.get('step', 'intake')
    if step == 'root_cause':
        return 'root_cause'

    if not state.get('retrieved_context'):
        return 'qdrant_query'
    return END


def build_naturopathy_graph():
    graph = StateGraph(NaturopathyState)
    
    # Add nodes
    graph.add_node('intake', intake_node)
    graph.add_node('qdrant_query', qdrant_query_node)
    graph.add_node('root_cause', root_cause_node)
    graph.add_node('treatment_design', treatment_design_node)
    graph.add_node('recommendation', recommendation_node)
    graph.add_node('guardrail', guardrail_output_node)
    
    # Entry point: always start at intake
    graph.set_entry_point('intake')
    
    # After intake: either continue to root_cause, go to guardrail (emergency), or END (wait for user)
    graph.add_conditional_edges(
        'intake',
        should_continue_after_intake,
        {
            'root_cause': 'root_cause',
            'guardrail': 'guardrail',
            'qdrant_query': 'qdrant_query',
            END: END
        }
    )
    
    # Analysis pipeline: root_cause → treatment_design → recommendation → guardrail → END
    graph.add_edge('root_cause', 'treatment_design')
    graph.add_edge('treatment_design', 'recommendation')
    graph.add_edge('recommendation', 'guardrail')
    graph.add_edge('guardrail', END)
    
    # Add edge from qdrant_query to END (or back to intake if needed)
    graph.add_edge('qdrant_query', 'intake')
    return graph.compile()

naturopathy_graph = build_naturopathy_graph()
